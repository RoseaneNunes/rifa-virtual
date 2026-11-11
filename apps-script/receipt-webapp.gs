/**
 * Web App do Google Apps Script que recebe os comprovantes de pagamento da rifa
 * e salva os arquivos no Google Drive.
 *
 * Como publicar:
 *   1. Acesse https://script.google.com e crie um novo projeto.
 *   2. Cole este arquivo no editor (Code.gs).
 *   3. Ajuste FOLDER_ID e SHARED_SECRET abaixo.
 *   4. Implantar > Nova implantação > Tipo: "App da Web".
 *      - Executar como: "Eu"
 *      - Quem pode acessar: "Qualquer pessoa"
 *   5. Copie a URL do App da Web e configure as variáveis de ambiente do site:
 *      - RECEIPT_UPLOAD_URL  = URL gerada
 *      - RECEIPT_SHARED_SECRET = mesmo valor de SHARED_SECRET
 *
 * Observação: SHARED_SECRET é uma proteção simples contra envios anônimos.
 * Use um valor longo e aleatório e mantenha-o apenas no servidor.
 */

// Deixe vazio ("") para salvar na raiz do Drive ou informe o ID de uma pasta.
var FOLDER_ID = "";

// Troque por um segredo forte e o mesmo valor em RECEIPT_SHARED_SECRET.
var SHARED_SECRET = "TROQUE_POR_UM_SEGREDO_FORTE";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respond({ ok: false, error: "empty_body" });
    }

    var body = JSON.parse(e.postData.contents);

    if (!SHARED_SECRET || body.secret !== SHARED_SECRET) {
      return respond({ ok: false, error: "unauthorized" });
    }

    if (!body.dataBase64 || !body.mimeType) {
      return respond({ ok: false, error: "missing_file" });
    }

    var blob = Utilities.newBlob(
      Utilities.base64Decode(body.dataBase64),
      body.mimeType,
      buildFileName(body)
    );

    var folder = FOLDER_ID
      ? DriveApp.getFolderById(FOLDER_ID)
      : DriveApp.getRootFolder();

    var file = folder.createFile(blob);

    file.setDescription(
      [
        "Rifa Knex Jr",
        "numero: " + (body.numero || "?"),
        "nome: " + (body.nome || "?"),
        "telefone: " + (body.telefone || "?"),
        "enviado em: " + new Date().toISOString(),
      ].join(" | ")
    );

    return respond({ ok: true, url: file.getUrl(), id: file.getId() });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

function doGet() {
  return respond({ ok: true, service: "rifa-receipt" });
}

function buildFileName(body) {
  var numero = String(body.numero || "sem-numero").replace(/[^\w-]/g, "");
  var nome = String(body.nome || "sem-nome")
    .replace(/[^\w]+/g, "_")
    .slice(0, 60);
  var stamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss"
  );

  return (
    "comprovante-" +
    numero +
    "-" +
    nome +
    "-" +
    stamp +
    extensionFor(body.mimeType)
  );
}

function extensionFor(mimeType) {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/heic":
      return ".heic";
    case "application/pdf":
      return ".pdf";
    default:
      return ".jpg";
  }
}

function respond(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
