"use server";


import { revalidatePath } from "next/cache";

import { connectToDB } from "../mongoose";

import User from "../models/user.model";
import Thread from "../models/thread.model";
import Community from "../models/community.model";


/// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Lista de posts paginada
export async function fetchPosts(pageNumber = 1, pageSize = 20) {
  connectToDB();

  // Calcula a quantidade de posts a pular com base no número da página e no tamanho da página.
  const skipAmount = (pageNumber - 1) * pageSize;

  // Cria uma consulta para buscar os posts que não têm pai (threads de nível superior) (uma thread que não é um comentário/resposta).
  const postsQuery = Thread.find({ parentId: { $in: [null, undefined] } })
    .sort({ createdAt: "desc" })
    .skip(skipAmount)
    .limit(pageSize)
    .populate({
      path: "author",
      model: User,
    })
    .populate({
      path: "community",
      model: Community,
    })
    .populate({
      path: "children", // Preenche o campo children
      populate: {
        path: "author", // Preenche o campo author dentro de children
        model: User,
        select: "_id name parentId image", // Seleciona apenas os campos _id e username do autor
      },
    });

  // Conta o número total de posts de nível superior (threads), ou seja, threads que não são comentários.
  const totalPostsCount = await Thread.countDocuments({
    parentId: { $in: [null, undefined] },
  }); // Obtém a contagem total de posts

  const posts = await postsQuery.exec();

  const isNext = totalPostsCount > skipAmount + posts.length;

  return { posts, isNext };
}

/// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Criação de uma nova thread
interface Params {
  text: string,
  author: string,
  communityId: string | null,
  path: string,
}

export async function createThread({ text, author, communityId, path }: Params) {
  try {
    connectToDB();

    const communityIdObject = await Community.findOne(
      { id: communityId },
      { _id: 1 }
    );

    const createdThread = await Thread.create({
      text,
      author,
      community: communityIdObject, // Atribui communityId se fornecido, ou deixa como nulo para uma conta pessoal
    });

    // Atualiza o modelo de Usuário
    await User.findByIdAndUpdate(author, {
      $push: { threads: createdThread._id },
    });

    if (communityIdObject) {
      // Atualiza o modelo de Comunidade
      await Community.findByIdAndUpdate(communityIdObject, {
        $push: { threads: createdThread._id },
      });
    }

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Falha ao criar thread: ${error.message}`);
  }
}

/// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Função auxiliar: Busca todas as threads filhas de forma recursiva
async function fetchAllChildThreads(threadId: string): Promise<any[]> {
  const childThreads = await Thread.find({ parentId: threadId });

  const descendantThreads = [];
  for (const childThread of childThreads) {
    const descendants = await fetchAllChildThreads(childThread._id);
    descendantThreads.push(childThread, ...descendants);
  }

  return descendantThreads;
}

/// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Exclusão de uma thread e suas descendentes
export async function deleteThread(id: string, path: string): Promise<void> {
  try {
    connectToDB();

    // Encontra a thread a ser excluída (a thread principal)
    const mainThread = await Thread.findById(id).populate("author community");

    if (!mainThread) {
      throw new Error("Thread não encontrada");
    }

    // Busca todas as threads filhas e suas descendentes de forma recursiva
    const descendantThreads = await fetchAllChildThreads(id);

    // Obtém todos os IDs de threads descendentes, incluindo o ID da thread principal e os IDs das threads filhas
    const descendantThreadIds = [
      id,
      ...descendantThreads.map((thread) => thread._id),
    ];

    // Extrai os IDs de autores e comunidades para atualizar os modelos de Usuário e Comunidade, respectivamente
    const uniqueAuthorIds = new Set(
      [
        ...descendantThreads.map((thread) => thread.author?._id?.toString()), // Usa encadeamento opcional para lidar com valores possivelmente indefinidos
        mainThread.author?._id?.toString(),
      ].filter((id) => id !== undefined)
    );

    const uniqueCommunityIds = new Set(
      [
        ...descendantThreads.map((thread) => thread.community?._id?.toString()), // Usa encadeamento opcional para lidar com valores possivelmente indefinidos
        mainThread.community?._id?.toString(),
      ].filter((id) => id !== undefined)
    );

    // Exclui de forma recursiva as threads filhas e suas descendentes
    await Thread.deleteMany({ _id: { $in: descendantThreadIds } });

    // Atualiza o modelo de Usuário
    await User.updateMany(
      { _id: { $in: Array.from(uniqueAuthorIds) } },
      { $pull: { threads: { $in: descendantThreadIds } } }
    );

    // Atualiza o modelo de Comunidade
    await Community.updateMany(
      { _id: { $in: Array.from(uniqueCommunityIds) } },
      { $pull: { threads: { $in: descendantThreadIds } } }
    );

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Falha ao excluir thread: ${error.message}`);
  }
}

/// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Busca uma thread pelo ID
export async function fetchThreadById(threadId: string) {
  connectToDB();

  try {
    const thread = await Thread.findById(threadId)
      .populate({
        path: "author",
        model: User,
        select: "_id id name image",
      }) // Preenche o campo author com _id e username
      .populate({
        path: "community",
        model: Community,
        select: "_id id name image",
      }) // Preenche o campo community com _id e name
      .populate({
        path: "children", // Preenche o campo children
        populate: [
          {
            path: "author", // Preenche o campo author dentro de children
            model: User,
            select: "_id id name parentId image", // Seleciona apenas os campos _id e username do autor
          },
          {
            path: "children", // Preenche o campo children dentro de children
            model: Thread, // O modelo das threads aninhadas (assumindo que seja o mesmo modelo "Thread")
            populate: {
              path: "author", // Preenche o campo author dentro de children aninhados
              model: User,
              select: "_id id name parentId image", // Seleciona apenas os campos _id e username do autor
            },
          },
        ],
      })
      .exec();

    return thread;
  } catch (err) {
    console.error("Erro ao buscar thread:", err);
    throw new Error("Não foi possível buscar a thread");
  }
}

/// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Adiciona um comentário a uma thread
export async function addCommentToThread(
  threadId: string,
  commentText: string,
  userId: string,
  path: string
) {
  connectToDB();

  try {
    // Encontra a thread original pelo ID
    const originalThread = await Thread.findById(threadId);

    if (!originalThread) {
      throw new Error("Thread não encontrada");
    }

    // Cria a nova thread de comentário
    const commentThread = new Thread({
      text: commentText,
      author: userId,
      parentId: threadId, // Define o parentId para o ID da thread original
    });

    // Salva a thread de comentário no banco de dados
    const savedCommentThread = await commentThread.save();

    // Adiciona o ID da thread de comentário ao array de children da thread original
    originalThread.children.push(savedCommentThread._id);

    // Salva a thread original atualizada no banco de dados
    await originalThread.save();

    revalidatePath(path);
  } catch (err) {
    console.error("Erro ao adicionar comentário:", err);
    throw new Error("Não foi possível adicionar o comentário");
  }
}

/// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Adiciona um like à thread
export async function addLikeToThread(threadId: string, userId: string) {
  try {
    // Encontrar a thread pelo ID
    const thread = await Thread.findById(threadId);

    if (!thread) {
      throw new Error("Thread não encontrada");
    }

    // Verificar se o usuário já deu like
    const indexOfUser = thread.likes.indexOf(userId);
    if (indexOfUser !== -1) {
      // Se o usuário já deu like, remover o like
      thread.likes.splice(indexOfUser, 1);
      console.log("Like removido com sucesso!");
    } else {
      // Se o usuário ainda não deu like, adicionar o like
      thread.likes.push(userId);
      console.log(userId)
      console.log("Like adicionado com sucesso!");
    }

    // Salvar a thread atualizada
    await thread.save();
  } catch (err) {
    throw new Error("Não foi possível modificar o like");
  }
}




