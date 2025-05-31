import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent>
            <h1 className="text-3xl font-bold mb-2">404</h1>
            <p className="mb-4 text-gray-600">
              Страница не найдена. Возможно, она была удалена.
            </p>
            <div className="flex space-x-2">
              <Button onClick={() => navigate(-1)}>Назад</Button>
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                На главную
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
