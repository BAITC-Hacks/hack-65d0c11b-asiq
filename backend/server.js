import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Проверка, что сервер работает
app.get("/", (req, res) => {
  res.json({
    project: "QazLedger AI",
    status: "online",
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// AI-анализ одной банковской операции
app.post("/api/analyze", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured",
      });
    }

    const {
      bank,
      date,
      amount,
      direction,
      counterparty,
      bin,
      iban,
      bik,
      knp,
      purpose,
      counterparty_found_in_1c,
    } = req.body;

    if (!amount || !purpose) {
      return res.status(400).json({
        error: "amount and purpose are required",
      });
    }

    const transaction = {
      bank: bank || "",
      date: date || "",
      amount,
      direction: direction || "unknown",
      counterparty: counterparty || "",
      bin: bin || "",
      iban: iban || "",
      bik: bik || "",
      knp: knp || "",
      purpose,
      counterparty_found_in_1c:
        typeof counterparty_found_in_1c === "boolean"
          ? counterparty_found_in_1c
          : null,
    };

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-terra",

      instructions: `
Ты QazLedger AI — AI-ассистент бухгалтера для Казахстана.

Твоя задача — анализировать ОДНУ банковскую операцию.

ВАЖНО:
- не выдумывай БИН, ИИН, счета, контрагентов или назначение платежа;
- используй только переданные данные;
- не проводи бухгалтерские документы;
- ты только классифицируешь операцию и даёшь рекомендацию;
- если данных недостаточно или операция неоднозначна,
  обязательно manual_review=true;
- если confidence ниже 0.85, manual_review должен быть true;
- окончательное создание документа выполняет 1С и бухгалтер;
- отвечай кратко и профессионально на русском языке.

Допустимые правила:

SALE
SUPPLIER_PAYMENT
KASPI_BANK_FEE
KASPI_PAY_FEE
KASPI_SHOP_FEE
REFUND
INTERNAL_TRANSFER
ACCOUNTABLE_PERSON
TAX_PAYMENT
PAYROLL
OTHER
MANUAL_REVIEW
      `,

      input: `
Проанализируй банковскую операцию:

${JSON.stringify(transaction, null, 2)}
      `,

      text: {
        format: {
          type: "json_schema",
          name: "qazledger_transaction_analysis",
          strict: true,

          schema: {
            type: "object",
            additionalProperties: false,

            properties: {
              rule: {
                type: "string",
                enum: [
                  "SALE",
                  "SUPPLIER_PAYMENT",
                  "KASPI_BANK_FEE",
                  "KASPI_PAY_FEE",
                  "KASPI_SHOP_FEE",
                  "REFUND",
                  "INTERNAL_TRANSFER",
                  "ACCOUNTABLE_PERSON",
                  "TAX_PAYMENT",
                  "PAYROLL",
                  "OTHER",
                  "MANUAL_REVIEW"
                ]
              },

              operation_name: {
                type: "string"
              },

              direction: {
                type: "string",
                enum: [
                  "incoming",
                  "outgoing",
                  "unknown"
                ]
              },

              suggested_document: {
                type: "string"
              },

              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1
              },

              manual_review: {
                type: "boolean"
              },

              reason: {
                type: "string"
              },

              suggested_comment: {
                type: "string"
              }
            },

            required: [
              "rule",
              "operation_name",
              "direction",
              "suggested_document",
              "confidence",
              "manual_review",
              "reason",
              "suggested_comment"
            ]
          }
        }
      }
    });

    const analysis = JSON.parse(response.output_text);

    // Дополнительная защита на сервере.
    // Даже если AI ошибся, низкая уверенность
    // автоматически отправляет операцию бухгалтеру.
    if (analysis.confidence < 0.85) {
      analysis.manual_review = true;
    }

    res.json({
      success: true,
      transaction,
      analysis,
    });

  } catch (error) {
    console.error("QazLedger AI error:", error);

    res.status(500).json({
      success: false,
      error: "AI analysis failed",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`QazLedger AI running on port ${PORT}`);
});
