// src/pages/InvitationsPage.tsx
import { useEffect, useState } from "react";
import api from "../api/axios";
import type { Invitation } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";

export default function InvitationsPage() {
  const [invites, setInvites] = useState<Invitation[]>([]);

  useEffect(() => {
    api.get<Invitation[]>("/invitations/").then((r) => setInvites(r.data));
  }, []);

  const handle = async (id: number, action: "accept" | "decline") => {
    try {
      await api.post(`/invitations/${id}/${action}/`);
      setInvites(invites.filter((i) => i.id !== id));
      toast.success(action === "accept" ? "Принято" : "Отклонено");
    } catch {
      toast.error("Ошибка");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Приглашения</h1>
      {invites.length > 0 ? (
        invites.map((inv) => (
          <Card key={inv.id}>
            <CardContent className="flex justify-between items-center">
              <div>
                Invite to <strong>{inv.team.name}</strong> от{" "}
                <em>{inv.inviter.username}</em>
              </div>
              <div className="space-x-2">
                <Button size="sm" onClick={() => handle(inv.id, "accept")}>
                  Принять
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handle(inv.id, "decline")}
                >
                  Отклонить
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <p>Нет новых приглашений</p>
      )}
    </div>
  );
}
