import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";
import { Configuration, OpenAIApi } from "openai";
import { getRandomCard, get3RandomCards } from "./src/helpers.js";
import { imageMappings } from "./src/const.js";

dotenv.config();

const token = process.env.TOKEN;
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

let bot;

if (process.env.NODE_ENV === "production") {
  const app = express();
  app.use(bodyParser.json());
  app.use(cors());
  bot = new TelegramBot(token, {
    autoStart: true,
    onlyFirstMatch: true,
    cancellation: true,
  });
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
  let server = app.listen(process.env.PORT, "0.0.0.0", () => {
    const host = server.address().address;
    const port = server.address().port;
    console.log("Web server started at http://%s:%s", host, port);
  });
  app.post("/" + bot.token, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
  console.log("Bot server started in the " + process.env.NODE_ENV + " mode");
} else {
  bot = new TelegramBot(token, {
    polling: true,
    autoStart: true,
    onlyFirstMatch: true,
    cancellation: true,
  });
  console.log("Bot server started in the " + process.env.NODE_ENV + " mode");
}

bot.on("polling_error", (error) => {
  console.log(error);
});

const gptCommandsMapping = (format, cards) => {
  if (format !== "week") {
    if (format === "advice") {
      return `Отвечай как специалист по картам Таро со стажем 40 лет.
      Задача: проведи онлайн-таро чтение “совет карт”, используя простую раскладку "Одна карта".
      Порядок действий:
      Растолкуй карту ${cards[0]} как совет.
      Я хочу чтобы твой ответ начинался с фразы: Карта которая вам выпала, на ваш вопрос - ${cards[0]} и далее только описание карты как совета, которую ты вытянул. Никаких вводных фраз не нужно.`;
    }

    return `Отвечай как специалист по картам Таро со стажем 40 лет. Задача: проведи онлайн-таро чтение на день, используя простую раскладку 'Одна карта'. Порядок действий:
    1)Растолкуй карту: ${cards[0]}.
    2)Я хочу чтобы твой ответ начинался с фразы: "Карта, которую я выбрала для тебя сегодня:" - ${cards[0]} и далее только описание карты, в контексте запроса “Карта дня”. Используй больше слов “Сегодня”. Никаких вводных фраз не нужно.`;
  } else {
    const stringCards = cards.join(", ");
    return `Отвечай как специалист по картам Таро со стажем 40 лет.
    Задача: проведи онлайн-таро чтение на неделю, используя простую раскладку “3 карты”. Порядок действий:
    Cделай интерпретацию этих карт: ${stringCards} с учетом расклада “расклад на неделю”.
    Я хочу чтобы твой ответ начинался с фразы: “ваши карты на загаданную неделю - ${stringCards} и далее только описание карт, которые ты вытянул. В конце, суммируй значение всех карт в вывод, в контексте гадания на неделю. Никаких вводных или приветственных фраз не нужно.`;
  }
};

async function sendMessage(msg, text, params) {
  await bot.sendMessage(msg.chat.id, text, params);
}

async function sendSticker(msg, stickerId) {
  await bot.sendSticker(msg.chat.id, stickerId);
}

async function getPrediction(msg, format) {
  try {
    const cards = format === "week" ? get3RandomCards() : getRandomCard();

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo-0301",
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: JSON.stringify(gptCommandsMapping(format, cards)),
        },
      ],
    });
    if (cards) {
      if (cards.length > 1) {
        const imagesId = cards.map((card) => {
          return imageMappings[card];
        });
        imagesId.forEach(async (stickerId) => {
          if (stickerId) {
            await sendSticker(msg, stickerId);
          }
        });
        await sendMessage(msg, `${completion.data.choices[0].message.content}`);
        return;
      }

      const imageId = [imageMappings[cards]];
      if (imageId[0]) {
        await sendSticker(msg, imageId[0]);
      }
      await sendMessage(msg, `${completion.data.choices[0].message.content}`);
    }
  } catch (error) {
    if (error.response) {
      await sendMessage(
        msg,
        `Что-то пошло не так. Вот что именно: ${error.response.statusText}`
      );
    } else {
      await sendMessage(
        msg,
        `Что-то сильно сломалось. Вот что именно: ${error.message}. Перешли это сообщение создателю этого бота: t.me/ivan_tolstov`
      );
    }
  }
}

bot.onText(/\/day/, async (ctx) => {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "Узнать карту",
          callback_data: JSON.stringify({
            command: "get_prediction",
            data: {
              type: "day",
            },
          }),
        },
      ],
    ],
  };

  await sendMessage(
    ctx,
    `Сделайте глубокий вдох и выдох, сфокусируйтесь на вашем запросе и как будете готовы, нажмите “УЗНАТЬ КАРТУ"`,
    {
      reply_markup: inlineKeyboard,
    }
  );
});

bot.onText(/\/week/, async (ctx) => {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "УЗНАТЬ ПРОГНОЗ",
          callback_data: JSON.stringify({
            command: "get_prediction",
            data: {
              type: "week",
            },
          }),
        },
      ],
    ],
  };

  await sendMessage(
    ctx,
    `Сделайте глубокий вдох и выдох, сфокусируйтесь на вашем запросе на неделю и как будете готовы, нажмите "УЗНАТЬ ПРОГНОЗ"`,
    {
      reply_markup: inlineKeyboard,
    }
  );
});

bot.onText(/\/advice/, async (ctx) => {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "ПОЛУЧИТЬ СОВЕТ",
          callback_data: JSON.stringify({
            command: "get_prediction",
            data: {
              type: "advice",
            },
          }),
        },
      ],
    ],
  };

  await sendMessage(
    ctx,
    `Перед тем, как мы начнем, я попрошу вас сконцентрироваться на своем вопросе и визуализировать его в своем уме. Сделайте глубокий вдох и выдох и как будете готовы, нажмите “ПОЛУЧИТЬ СОВЕТ”`,
    {
      reply_markup: inlineKeyboard,
    }
  );
});

bot.on("callback_query", async (query) => {
  const parsedQuery = JSON.parse(query.data);
  const {
    data: { type },
    command,
  } = parsedQuery;

  if (command === "get_prediction") {
    if (type === "day") {
      bot.deleteMessage(query.message.chat.id, query.message.message_id);
      await sendMessage(
        query.message,
        "Я провожу ритуал для очищения энергии и подключения к мудрости Таро. Я перемешиваю колоду, думая о твоем запросе... Мне нужно время, чтобы обдумать выпавший результат... Пожалуйста, подожди..."
      );
      getPrediction(query.message, "day");
    } else if (type === "week") {
      bot.deleteMessage(query.message.chat.id, query.message.message_id);
      await sendMessage(
        query.message,
        "Я перемешал колоду таро и вытянул для вас три карты, которые дадут прогноз на грядущую неделю. Мне нужно время, чтобы обдумать выпавший результат... Пожалуйста, подожди..."
      );
      getPrediction(query.message, "week");
    } else if (type === "advice") {
      bot.deleteMessage(query.message.chat.id, query.message.message_id);
      await sendMessage(
        query.message,
        "Я перемешиваю колоду Таро, сфокусировавшись на вашем вопросе. Помни, что карты открыты тому, кто обращается из нужды, а не из праздного любопытства... Мне нужно время, чтобы обдумать выпавший результат... Пожалуйста, подожди..."
      );
      getPrediction(query.message, "advice");
    }
  }
});

bot.on("sticker", (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, msg.sticker.file_id);

  // bot.sendSticker(
  //   chatId,
  //   "CAACAgQAAxkBAAOEZGeV4GXox2_-Gj1Qx1dSfOgkDMgAAggKAAJ812lSo75ZY9uNm2AvBA"
  // );
});
