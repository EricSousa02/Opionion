// HeartIcon.js
"use client";
import Image from "next/image";
import { addLikeToThread } from "../../lib/actions/thread.actions";
import { useState } from "react";

interface HeartIconProps {
  threadId: string;
  userId: string;
  isLiked: boolean;
}

function HeartIcon({ threadId, userId, isLiked }: HeartIconProps) {
  // Inicializa o estado com o valor de isLiked
  const [liked, setLiked] = useState(isLiked);

  const handleLikeClick = () => {
    // Atualiza o estado de liked para o valor oposto do estado atual
    setLiked((prevLiked) => !prevLiked);
    // Chama a função para adicionar o like à thread
    addLikeToThread(threadId, userId);
  };

  return (
    <div className="flex cursor-pointer object-contain " onClick={handleLikeClick}>
      <Image
        src={liked ? `/assets/heart-filled.svg` : `/assets/heart-gray.svg`}
        alt="heart"
        width={24}
        height={24}
      />
    </div>
  );
}

export default HeartIcon;
