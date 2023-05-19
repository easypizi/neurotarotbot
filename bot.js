const { Configuration, OpenAIApi } = require("openai");
const Bot = require("node-telegram-bot-api");
const token = process.env.TOKEN;
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
let bot;

const gptCommandsMapping = {
  day: `Отвечай как специалист по картам Таро со стажем 40 лет. Задача: проведи онлайн-таро чтение на день, используя простую раскладку 'Одна карта'.  Порядок действий: 
  1) Вытяни для меня одну карту таро 
  2) Растолкуй эту карту. 
  3) Я хочу чтобы твой ответ начинался с фразы: "Я провожу ритуал для очищения энергии и подключения к мудрости Таро. Я перемешиваю колоду, думая о твоем запросе. Карта, которую я выбрала для тебя сегодня:" - [название карты которую вытянул на русском и английском через /] и далее только описание карты, в контексте запроса “Карта дня”, которую ты вытянул. 
  Используй больше слов “Сегодня”. 
  Никаких вводных фраз не нужно.`,
  week: `Отвечай как специалист по картам Таро со стажем 40 лет. 
  Задача: проведи онлайн-таро чтение на неделю, используя простую раскладку “3 карты”. Порядок действий:
  1) Вытяни для меня 3 карт таро
  2) Карта №1 - обозначает начало недели
  3) карта №2 середину недели
  4) Карта №3 конец недели
  5) Растолкуй эти карты по порядку от карты №1 к карте №3. 
  Я хочу чтобы твой ответ начинался с фразы: "Я перемешал колоду таро и вытянул для вас три карты, которые дадут прогноз на грядущую неделю. “ваша карта на “период недели” - “название карты которую вытянул на русском и английском” и далее только описание карты, которую ты вытянул. В конце, суммируй значение всех карт в вывод, в контексте гадания на неделю. Никаких вводных или приветственных фраз не нужно.`,
  advice: `Отвечай как специалист по картам Таро со стажем 40 лет. 
  Задача: проведи онлайн-таро чтение “совет карт”, используя простую раскладку "Одна карта". 
  Порядок действий:
  Вытяни для меня одну карту таро
  Растолкуй эту карту как совет. 
  Я хочу чтобы твой ответ начинался с фразы: "Я перемешиваю колоду Таро, сфокусировавшись на вашем вопросе. Помни, что карты открыты тому, кто обращается из нужды, а не из праздного любопытства". 
  Карта которая вам выпала, на ваш вопрос - [название карты которую вытянул на русском и английским через /] и далее только описание карты как совета, которую ты вытянул. Никаких вводных фраз не нужно.`
}

if (process.env.NODE_ENV === "production") {
  bot = new Bot(token);
  bot.setWebHook(process.env.HEROKU_URL + bot.token);
} else {
  bot = new Bot(token, { polling: true });
}

console.log("Bot server started in the " + process.env.NODE_ENV + " mode");

bot.on("polling_error", (error) => {
  console.log(error);
});

function sendMessage(msg, text) {
  bot.sendMessage(msg.chat.id, text);
}

// function getRandomWorkText() {
//   let workImitationArray = [
//     "Перевожу...",
//     "Абажжи, ща всё будет...",
//     "Ждите, ваш перевод обрабатывается...",
//     "Опять переводить...",
//     "Рад служить, кожаный мешок, твой перевод в пути...",
//   ];

//   const randomElement = Math.floor(Math.random() * workImitationArray.length);

//   return workImitationArray[randomElement];
// }

async function getPrediction(msg, format) {
  try {
    // sendMessage(msg, getRandomWorkText());
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: gptCommandsMapping(format),
        },
      ],
    });
    sendMessage(
      msg,
      `${completion.data.choices[0].message.content}`
    );
  } catch (error) {
    if (error.response) {
      sendMessage(
        msg,
        `Что-то пошло не так. Вот что именно: ${error.response.data}`
      );
    } else {
      sendMessage(
        msg,
        `Что-то сильно сломалось. Вот что именно: ${error.message}. Перешли это сообщение создателю этого бота: t.me/ivan_tolstov`
      );
    }
  }
}



bot.onText(/\/day/, async (ctx) => {
  getPrediction(ctx, "day")
})

bot.onText(/\/week/, async (ctx) => {
  getPrediction(ctx, "week")
})

bot.onText(/\/advice/, async (ctx) => {
  getPrediction(ctx, "advice")
})

module.exports = bot;
