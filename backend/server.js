import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));
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
// Анализ транзакционной сети для HackAlem AI / MoneyGraph
app.post("/api/moneygraph", async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "transactions array is required",
      });
    }

    // Узлы графа
    const nodes = new Map();

    function getNode(id) {
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          incoming_amount: 0,
          outgoing_amount: 0,
          incoming_count: 0,
          outgoing_count: 0,
          senders: new Set(),
          receivers: new Set(),
        });
      }

      return nodes.get(id);
    }

    // Собираем статистику
    for (const tx of transactions) {
      const from = String(tx.from || "").trim();
      const to = String(tx.to || "").trim();
      const amount = Number(tx.amount || 0);

      if (!from || !to || !amount || amount <= 0) continue;

      const sender = getNode(from);
      const receiver = getNode(to);

      sender.outgoing_amount += amount;
      sender.outgoing_count += 1;
      sender.receivers.add(to);

      receiver.incoming_amount += amount;
      receiver.incoming_count += 1;
      receiver.senders.add(from);
    }

    // Вычисляем роли и риск
    const analyzedNodes = Array.from(nodes.values()).map((node) => {
      const incoming = node.incoming_amount;
      const outgoing = node.outgoing_amount;

      const throughput =
        incoming > 0
          ? Math.min(outgoing / incoming, 1.5)
          : outgoing > 0
          ? 1
          : 0;

      let role = "NORMAL";
      let risk = 10;

      // Collector:
      // получает от многих участников и переводит дальше
      if (
        node.senders.size >= 3 &&
        incoming > 0 &&
        outgoing >= incoming * 0.6
      ) {
        role = "COLLECTOR";
        risk += 45;
      }

      // Distributor:
      // получает и распределяет по многим получателям
      if (
        node.receivers.size >= 3 &&
        incoming > 0 &&
        outgoing > 0
      ) {
        role = "DISTRIBUTOR";
        risk += 35;
      }

      // Transit:
      // почти всё полученное быстро уходит дальше
      if (
        incoming > 0 &&
        throughput >= 0.85 &&
        node.senders.size <= 2 &&
        node.receivers.size <= 2
      ) {
        role = "TRANSIT";
        risk += 30;
      }

      // Sink:
      // много получает и почти ничего не отправляет
      if (
        incoming > 0 &&
        outgoing < incoming * 0.15 &&
        node.senders.size >= 2
      ) {
        role = "SINK";
        risk += 20;
      }

      // Дополнительные признаки
      risk += Math.min(node.senders.size * 3, 15);
      risk += Math.min(node.receivers.size * 2, 10);

      risk = Math.min(Math.round(risk), 100);

      return {
        id: node.id,
        role,
        risk_score: risk,

        incoming_amount: Number(incoming.toFixed(2)),
        outgoing_amount: Number(outgoing.toFixed(2)),

        incoming_count: node.incoming_count,
        outgoing_count: node.outgoing_count,

        unique_senders: node.senders.size,
        unique_receivers: node.receivers.size,

        flow_ratio:
          incoming > 0
            ? Number((outgoing / incoming).toFixed(2))
            : null,
      };
    });

    analyzedNodes.sort((a, b) => b.risk_score - a.risk_score);

    const topRisk = analyzedNodes.slice(0, 10);

    let aiSummary = null;

    // OpenAI нужен только для объяснения,
    // сами расчёты выполняются обычным кодом.
    if (process.env.OPENAI_API_KEY) {
      const response = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5.6-terra",

        instructions: `
Ты аналитик AML.

Тебе переданы результаты алгоритмического анализа
финансовой транзакционной сети.

Не выдумывай факты.
Не утверждай, что человек совершил преступление.
Используй формулировки:
"требует проверки",
"аномальный паттерн",
"повышенный риск",
"рекомендуется дополнительная проверка".

Нужно кратко:
1. определить наиболее интересные узлы;
2. объяснить, почему они получили высокий risk_score;
3. указать вероятную роль узла;
4. дать порядок проверки аналитиком.

Ответ на русском языке.
`,

        input: JSON.stringify(topRisk, null, 2),
      });

      aiSummary = response.output_text;
    }

    res.json({
      success: true,

      stats: {
        transactions: transactions.length,
        nodes: analyzedNodes.length,
      },

      nodes: analyzedNodes,

      edges: transactions.map((tx, index) => ({
        id: index + 1,
        from: tx.from,
        to: tx.to,
        amount: Number(tx.amount),
        date: tx.date || "",
      })),

      top_risk: topRisk,

      ai_summary: aiSummary,
    });

  } catch (error) {
    console.error("MoneyGraph error:", error);

    res.status(500).json({
      success: false,
      error: "MoneyGraph analysis failed",
      details: error.message,
    });
  }
});
app.listen(PORT, () => {
  console.log(`QazLedger AI running on port ${PORT}`);
});
