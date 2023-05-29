import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";
import { Configuration, OpenAIApi } from "openai";
import { getRandomCards } from "./src/helpers.js";
import { imageMappings, cardsAmountMapping } from "./src/const.js";

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
  if (format === "day") {
    return `Отвечай как специалист по картам Таро со стажем 40 лет. Задача: проведи онлайн-таро чтение на день, используя простую раскладку 'Одна карта'. Порядок действий:
    1)Растолкуй карту: ${cards[0]}.
    2)Я хочу чтобы твой ответ начинался с фразы: "Карта, которую я выбрала для тебя сегодня:" - ${cards[0]} и далее только описание карты, в контексте запроса “Карта дня”. Используй больше слов “Сегодня”. Никаких вводных фраз не нужно.`;
  }

  if (format === "advice") {
    return `Отвечай как специалист по картам Таро со стажем 40 лет.
      Задача: проведи онлайн-таро чтение “совет карт”, используя простую раскладку "Одна карта".
      Порядок действий:
      Растолкуй карту ${cards[0]} как совет.
      Я хочу чтобы твой ответ начинался с фразы: Карта которая вам выпала, на ваш вопрос - ${cards[0]} и далее только описание карты как совета, которую ты вытянул. Никаких вводных фраз не нужно.`;
  }

  if (format === "week") {
    const stringCards = cards.join(", ");
    return `Отвечай как специалист по картам Таро со стажем 40 лет.
    Задача: проведи онлайн-таро чтение на неделю, используя простую раскладку “3 карты”. Порядок действий:
    Cделай интерпретацию этих карт: ${stringCards} с учетом расклада “расклад на неделю”.
    Я хочу чтобы твой ответ начинался с фразы: “ваши карты на загаданную неделю - ${stringCards} и далее только описание карт, которые ты вытянул. В конце, суммируй значение всех карт в вывод, в контексте гадания на неделю. Никаких вводных или приветственных фраз не нужно.`;
  }

  if (format === "problem") {
    const stringCards = cards.join(", ");

    return `Отвечай как специалист по картам Таро со стажем 40 лет. Задача: проведи онлайн-таро чтение расклада “следующий шаг”, используя раскладку “четыре карты”. 
    Порядок действий:
    Вот карты которые надо истолковать в правильном порядке: ${stringCards}. Карта 1 отвечает за “ исходную ситуация”, Карта 2 отвечает за “то, что сейчас не важно”, Карта 3 отвечает за “то, что сейчас важно”, карта 4 в позиции “Итог, следующий шаг”.
    Сделай толкование этих карт по отдельности и выводом вместе. 
    Я хочу чтобы твой ответ начинался с фразы “В позиции Исходной ситуации вам выпала карта название первой карты - это означает “трактование карты в контексте исходной ситуации”, В позиции “То, что сейчас не важно” выпала: "название второй карты" - это означает “трактовка карты с учетом ее позиции”, В позиции “То, что сейчас важно” выпала "название третьей карты" - что означает “трактование карты с учетом позиции”. Итогом ваших действий будет “название 4й карты” что означает, что вам нужно “трактовка четвертой карты с учетом позиции итога и последующего шага”. Никаких вводных фраз не нужно.
    `;
  }

  if (format === "love") {
    const stringCards = cards.join(", ");

    return `Отвечай как специалист по картам Таро со стажем 40 лет. Задача: проведи онлайн-таро чтение расклада “Отношенияг”, используя раскладку “пять карт”. 
    Порядок действий:
    Вот карты которые надо истолковать в правильном порядке: ${stringCards}.  Карта 1 отвечает за “чувства партнера к вам”, Карта 2 отвечает за “ваши чувства к партнеру”, Карта 3 отвечает за “Что вас сближает”, карта 4 в позиции “что разъединяет”, Карта №5 в позиции “какое будет развитие отношений”
    Сделай толкование этих карт. 
    Я хочу чтобы твой ответ начинался с фразы “В позиции “чувства партнера к вам” выпала карта “название карты 1 которую ты вытащил”  - это означает “трактование карты в контексте исходной ситуации”, В позиции “ваши чувства к партнеру” выпала “карта №2” - это означает “трактовка карты с учетом ее позиции”, В позиции “Что вас сближает” выпала “карта №3” - что означает “трактование карты с учетом позиции”. В позиции “что вас разъединяет” будет “карта №4” что означает, что вам нужно “трактовка карты №4 с учетом позиции карты”. В позиции “какое будет развитие отношений”  будет карта 5.  Никаких вводных фраз не нужно.
    `;
  }

  if (format === "future") {
    const stringCards = cards.join(", ");

    return `Отвечай как специалист по картам Таро со стажем 40 лет. Задача: проведи онлайн-таро чтение расклада “ближайшее будущее”, используя раскладку “4 карты”. 
    Порядок действий:
    Вот карты которые надо истолковать в правильном порядке: ${stringCards}.  Карта 1 отвечает за “Прошлое”, Карта 2 отвечает за “Настоящее”, Карта 3 отвечает за “Будущее”, карта 4 в позиции “Совет”. 
    Сделай толкование этих карт по отдельности и далее коротко суммируй ответ. 
    Я хочу чтобы твой ответ начинался с фразы “В позиции “Прошлое” выпала карта “название карты 1 которую ты вытащил”  - это означает “трактование карты в контексте исходной ситуации”, В позиции “настоящее” выпала “карта №2” - это означает “трактовка карты с учетом ее позиции”, В позиции “Будущее” выпала “карта №3” - что означает “трактование карты с учетом позиции”. В позиции “Совет карт” будет “карта №4” что означает, что вам нужно “трактовка карты №4 с учетом позиции карты”. Никаких вводных фраз не нужно.
    `;
  }

  if (format === "money") {
    const stringCards = cards.join(", ");

    return `Отвечай как специалист по картам Таро со стажем 40 лет. Задача: проведи онлайн-таро чтение расклада “Финансовый прогноз”, используя раскладку “4 карты”. 
    Порядок действий:
    Вот карты которые надо истолковать в правильном порядке: ${stringCards}.Карта 1 отвечает за “Текущее финансовое состояние”, Карта 2 отвечает за “Что может помочь улучшить материальное положение”, Карта 3 отвечает за “Что вам мешает и является преградой”, карта 4 в позиции “Итог”. 
    Сделай толкование этих карт по отдельности. 
    Я хочу чтобы твой ответ начинался с фразы “В позиции “Текущее финансовое состояние” выпала карта “название карты 1 которую ты вытащил”  - это означает “трактование карты в контексте исходной ситуации”, В позиции “Что может помочь улучшить материальное положение” выпала “карта №2” - это означает “трактовка карты с учетом ее позиции”, В позиции “Что вам мешает и является преградой” выпала “карта №3” - что означает “трактование карты с учетом позиции”. В позиции “Итог” будет “карта №4” что означает, что вам нужно “трактовка карты №4 с учетом позиции карты”. Никаких вводных фраз не нужно.
    `;
  }
};

async function sendMessage(msg, text, params) {
  await bot.sendMessage(msg.chat.id, text, params);
}

async function sendSticker(msg, stickerId) {
  await bot.sendSticker(msg.chat.id, stickerId);
}

async function sendStickers(stickersId, msg) {
  for (const stickerId of stickersId) {
    await sendSticker(msg, stickerId);
  }
}

async function getPrediction(msg, format) {
  try {
    const cardsAmount = cardsAmountMapping[format];
    const cards = getRandomCards(cardsAmount);

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
        await sendStickers(imagesId, msg);
        setTimeout(() => {}, 2000);
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

bot.onText(/\/problem/, async (ctx) => {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "Узнать результат",
          callback_data: JSON.stringify({
            command: "get_prediction",
            data: {
              type: "problem",
            },
          }),
        },
      ],
    ],
  };

  await sendMessage(
    ctx,
    `Расклад поможет наметить пути выхода из создавшегося положения, определить приоритеты и отбросить то, что на данный момент не важно.\n\nСделайте глубокий вдох и внимательно подумайте о ситуации на которую делаете расклад. Сделайте медленный выдох.`,
    {
      reply_markup: inlineKeyboard,
    }
  );
});

bot.onText(/\/money/, async (ctx) => {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "Узнать результат",
          callback_data: JSON.stringify({
            command: "get_prediction",
            data: {
              type: "money",
            },
          }),
        },
      ],
    ],
  };

  await sendMessage(
    ctx,
    `Расклад подойдет тем, кто хочет узнать что судьба сулит ему в финансовом плане. Карты рассмотрят вашу текущую ситуацию, посмотрят что ждет в будущем и дадут совет, как действовать в будущем.`,
    {
      reply_markup: inlineKeyboard,
    }
  );
});

bot.onText(/\/love/, async (ctx) => {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "Узнать результат",
          callback_data: JSON.stringify({
            command: "get_prediction",
            data: {
              type: "love",
            },
          }),
        },
      ],
    ],
  };

  await sendMessage(
    ctx,
    `Расклад покажет развитие отношений с уже имеющимся партнером, а также укажет на перспективы с новым избранником.\n\nСделайте глубокий вдох и выдох. \nНастройтесь на ваш вопрос, внимательно подумайте о партнере. 
    `,
    {
      reply_markup: inlineKeyboard,
    }
  );
});

bot.onText(/\/future/, async (ctx) => {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "Узнать результат",
          callback_data: JSON.stringify({
            command: "get_prediction",
            data: {
              type: "future",
            },
          }),
        },
      ],
    ],
  };

  await sendMessage(
    ctx,
    `Расклад позволит взглянуть что вас ждет в ближайшем будущем, в краткосрочной перспективе.\n\nСделайте глубокий, настройтесь на ваш вопрос. Сделайте медленный выдох.\nПомните, что от того как вы задаете вопрос, зависит его трактовка. Обдумайте хорошо что именно вы хотите спросить и помните, что карты дают ответ только тем, кто искренне этого желает.
    `,
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
    bot.deleteMessage(query.message.chat.id, query.message.message_id);
    if (type === "day") {
      await sendMessage(
        query.message,
        "Я провожу ритуал для очищения энергии и подключения к мудрости Таро. Я перемешиваю колоду, думая о твоем запросе... Мне нужно время, чтобы обдумать выпавший результат... Пожалуйста, подожди..."
      );
      getPrediction(query.message, "day");
    } else if (type === "week") {
      await sendMessage(
        query.message,
        "Я перемешал колоду таро и вытянул для вас три карты, которые дадут прогноз на грядущую неделю. Мне нужно время, чтобы обдумать выпавший результат... Пожалуйста, подожди..."
      );
      getPrediction(query.message, "week");
    } else if (type === "advice") {
      await sendMessage(
        query.message,
        "Я перемешиваю колоду Таро, сфокусировавшись на вашем вопросе. Помни, что карты открыты тому, кто обращается из нужды, а не из праздного любопытства... Мне нужно время, чтобы обдумать выпавший результат... Пожалуйста, подожди..."
      );
      getPrediction(query.message, "advice");
    } else if (type === "problem") {
      await sendMessage(
        query.message,
        "Мне нужно время, чтобы обдумать выпавший результат... Пожалуйста, подожди..."
      );
      getPrediction(query.message, "problem");
    } else if (type === "love") {
      await sendMessage(
        query.message,
        "Мне нужно время, чтобы обдумать выпавший результат... Пожалуйста, подожди..."
      );
      getPrediction(query.message, "love");
    } else if (type === "money") {
      await sendMessage(
        query.message,
        "Мне нужно время, чтобы обдумать выпавший результат... Пожалуйста, подожди..."
      );
      getPrediction(query.message, "money");
    } else if (type === "future") {
      await sendMessage(
        query.message,
        "Мне нужно время, чтобы обдумать выпавший результат... Пожалуйста, подожди..."
      );
      getPrediction(query.message, "future");
    }
  }
});
