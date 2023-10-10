import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex items-center justify-center h-screen bg-pri w-screen py-6">
        <SignIn />;
    </div>
  )
}
