import { getSessionUser } from "@/lib/supabase/server";
import { ChatConsole } from "@/components/admin/chat-console";

export const dynamic = "force-dynamic";

export const metadata = { title: "লাইভ চ্যাট" };

/* ==========================================================================
   /foisal/chats — the team's live-chat desk
   --------------------------------------------------------------------------
   Read access is deliberately wider than write access: any staff member may
   open this page and watch the queue (the owner wants every staffer to know a
   customer is waiting), but only the member who claimed a chat gets a typing
   box. That decision lives in the API + chat_claim(), not in this component.
   ========================================================================== */

export default async function AdminChatsPage() {
  const user = await getSessionUser();
  return <ChatConsole me={user?.id ?? ""} />;
}
