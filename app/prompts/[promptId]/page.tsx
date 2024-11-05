"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export default function EditPromptPage({
  params,
}: {
  params: { promptId: Id<"prompts"> };
}) {
  const prompt = useQuery(api.prompts.getPromptById, {
    promptId: params.promptId,
  });

  const updatePrompt = useMutation(api.prompts.updatePrompt);
  const isAdmin = useQuery(api.users.isAdmin);

  const [promptName, setPromptName] = useState("");
  const [promptText, setPromptText] = useState("");

  useEffect(() => {
    if (prompt) {
      setPromptName(prompt.promptName);
      setPromptText(prompt.prompt);
    }
  }, [prompt]);

  const handlePromptNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPromptName(e.target.value);
  };

  const handlePromptTextChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setPromptText(e.target.value);
  };

  const router = useRouter();
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt) return;

    updatePrompt({ promptId: prompt._id, promptName, prompt: promptText });
    router.push("/prompts");
  };

  if (!isAdmin) {
    redirect("/");
    return null;
  }

  return (
    <Page>
      <form className="h-full px-6 py-6" onSubmit={handleSubmit}>
        <div className="mb-4 flex justify-between">
          <h1 className="mb-4 font-semibold">Edit your prompt</h1>
          <div className="flex space-x-4">
            <Button variant="default">Save</Button>
            <Button asChild variant="default">
              <Link href="/prompts">Return</Link>
            </Button>
          </div>
        </div>
        <div className="flex h-screen min-h-screen flex-col items-start space-y-4">
          <Input
            placeholder="Prompt Name"
            value={promptName}
            onChange={handlePromptNameChange}
          />
          <textarea
            placeholder="Prompt"
            className="h-full w-full rounded-md border border-input bg-transparent px-3 py-1"
            value={promptText}
            onChange={handlePromptTextChange}
          />
        </div>
      </form>
    </Page>
  );
}
