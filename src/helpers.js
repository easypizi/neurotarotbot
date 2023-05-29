import { cards } from "./const.js";

export const getRandomCards = (amount) => {
  let numbers = new Set();

  while (numbers.size < amount) {
    numbers.add(Math.floor(Math.random() * 78));
  }

  const result = Array.from(numbers).map((index) => {
    return cards[index];
  });

  return result;
};
