import Link from "next/link";

function AddThread() {
  return (
    <Link href="/create-thread">
      <div title="up" className="drop-shadow-pri group fixed bottom-20 right-[1rem] z-50 cursor-pointer rounded-full bg-pri p-2 md:p-1 md:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
          <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
        </svg>
      </div>
    </Link>
  );
}

export default AddThread;
