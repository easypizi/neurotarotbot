import { cards } from "./const.js";

export const getRandomCard = () => {
  const index = Math.floor(Math.random() * 8);
  return [cards[index]];
};

export const get3RandomCards = () => {
  let numbers = new Set();

  while (numbers.size < 3) {
    numbers.add(Math.floor(Math.random() * 78));
  }

  const result = Array.from(numbers).map((index) => {
    return cards[index];
  });

  return result;
};
