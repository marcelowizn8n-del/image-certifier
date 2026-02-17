import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Api() {
  const { t } = useLanguage();
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://imgcertifier.app";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="text-api-title">
              {t("api.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">{t("api.authenticationTitle")}</h2>
              <p className="text-muted-foreground">{t("api.authenticationDescription")}</p>
              <div className="rounded-md border bg-muted/30 p-4">
                <pre className="text-xs overflow-auto whitespace-pre">{`# Header recomendado
x-api-key: SUA_API_KEY

# Alternativa suportada
Authorization: Bearer SUA_API_KEY`}</pre>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">{t("api.endpointsTitle")}</h2>
              <div className="space-y-4">
                <div>
                  <p className="font-medium">POST /api/v1/analyze-url</p>
                  <p className="text-muted-foreground text-sm">{t("api.analyzeUrlDescription")}</p>
                  <div className="rounded-md border bg-muted/30 p-4 mt-2">
                    <pre className="text-xs overflow-auto whitespace-pre">{`curl -i -X POST '${baseUrl}/api/v1/analyze-url' \\
  -H 'x-api-key: SUA_API_KEY' \\
  -H 'content-type: application/json' \\
  --data '{"url":"https://upload.wikimedia.org/wikipedia/commons/3/3f/JPEG_example_flower.jpg"}'`}</pre>
                  </div>
                </div>

                <div>
                  <p className="font-medium">POST /api/v1/analyze</p>
                  <p className="text-muted-foreground text-sm">{t("api.analyzeUploadDescription")}</p>
                  <div className="rounded-md border bg-muted/30 p-4 mt-2">
                    <pre className="text-xs overflow-auto whitespace-pre">{`python3 - <<'PY' '/caminho/para/imagem.png' | curl -i -X POST '${baseUrl}/api/v1/analyze' \\
  -H 'x-api-key: SUA_API_KEY' \\
  -H 'content-type: application/json' \\
  --data-binary @-
import sys, base64, json, os
p = sys.argv[1]
with open(p, 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('ascii')
print(json.dumps({"imageData": b64, "filename": os.path.basename(p)}))
PY`}</pre>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">{t("api.limitsTitle")}</h2>
              <p className="text-muted-foreground">{t("api.limitsDescription")}</p>
              <div className="rounded-md border bg-muted/30 p-4">
                <pre className="text-xs overflow-auto whitespace-pre">{`Rate limit: 60 requests/minuto por API key
Quota mensal padrão:
- Basic: 1.000 análises/mês
- Premium: 10.000 análises/mês
- Enterprise: sob contrato (definido no momento de criação da API key)`}</pre>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">{t("api.errorsTitle")}</h2>
              <div className="rounded-md border bg-muted/30 p-4">
                <pre className="text-xs overflow-auto whitespace-pre">{`401 Unauthorized
- API key ausente ou inválida

403 Quota exceeded
- Você atingiu a quota mensal da sua API key

429 Rate limit exceeded
- Muitas requisições no mesmo minuto

400 Invalid request body
- Campos obrigatórios ausentes ou inválidos`}</pre>
              </div>
            </section>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
