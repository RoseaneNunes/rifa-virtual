This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Comprovante de pagamento

O formulário de reserva exige o upload do comprovante do Pix (imagem ou PDF, até
4 MB). O arquivo **não** é enviado ao Google Forms — ele é repassado pela rota
`POST /api/receipt` para um Web App do Google Apps Script, que salva o comprovante
no Google Drive.

### Configuração

1. Publique o script em [`apps-script/receipt-webapp.gs`](apps-script/receipt-webapp.gs)
   seguindo as instruções no topo do arquivo.
2. Defina as variáveis de ambiente (local e na Vercel):

   | Variável | Descrição |
   | --- | --- |
   | `RECEIPT_UPLOAD_URL` | URL do Web App publicado no Apps Script |
   | `RECEIPT_SHARED_SECRET` | Mesmo segredo configurado no Apps Script |
   | `SHEET_CSV_URL` | CSV publicado da planilha de reservados |
   | `SHEET_NUMERO_COLUMN` | Coluna com o número da rifa (padrão: `numero da rifa`) |

   Use o [`.env.example`](.env.example) como base.

> Sem `RECEIPT_UPLOAD_URL` configurada, a rota responde `503` e a reserva não é
> concluída (o comprovante é obrigatório).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
