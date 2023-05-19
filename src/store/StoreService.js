import { createStore, createEvent, createEffect } from "effector";

class StoreService {
  constructor() {
    this.stores = {};
  }

  async createBotStore(chatId) {
    const botStore = createStore({
      day_prediction_date: 0,
      week_prediction_date: 0,
      advice_prediction_date: 0,
    });

    this.stores[chatId] = botStore;

    return botStore;
  }

  async getBotStore(chatId) {
    if (this.stores[chatId]) {
      return this.stores[chatId];
    }

    const botStore = await this.createBotStore(chatId);
    return botStore;
  }

  async getStoreState(chatId) {
    const store = await this.getBotStore(chatId);
    return store.getState();
  }

  async updateDayPredictionDate(chatId) {
    const botStore = await this.getBotStore(chatId);
    const updatedDayPredictionTime = createEvent();
    const updatedDayPredictionEffect = createEffect((params) => {
      botStore.setState(params);
    });
    const currentMoment = new Date();
    updatedDayPredictionTime.watch(() => {
      updatedDayPredictionEffect({
        ...botStore.getState(),
        day_prediction_date: currentMoment,
      });
    });
    updatedDayPredictionTime();
  }

  async updateWeekPredictionDate(chatId) {
    const botStore = await this.getBotStore(chatId);
    const updatedWeekPredictionTime = createEvent();
    const updatedWeekPredictionEffect = createEffect((params) => {
      botStore.setState(params);
    });
    const currentMoment = new Date();
    updatedWeekPredictionTime.watch(() => {
      updatedWeekPredictionEffect({
        ...botStore.getState(),
        week_prediction_date: currentMoment,
      });
    });
    updatedWeekPredictionTime();
  }

  async updateAdvicePredictionDate(chatId) {
    const botStore = await this.getBotStore(chatId);
    const updatedAdvicePredictionTime = createEvent();
    const updatedAdvicePredictionEffect = createEffect((params) => {
      botStore.setState(params);
    });
    const currentMoment = new Date();
    updatedAdvicePredictionTime.watch(() => {
      updatedAdvicePredictionEffect({
        ...botStore.getState(),
        advice_prediction_date: currentMoment,
      });
    });
    updatedAdvicePredictionTime();
  }
}

export default new StoreService();
