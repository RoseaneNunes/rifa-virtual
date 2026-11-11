function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// Números disponíveis para compra: 201–210, 231–287, 289–330,
// 351–433, 435–437 e 439–443.
export const NUMBERS = [
  ...range(201, 210),
  ...range(231, 287),
  ...range(289, 330),
  ...range(351, 433),
  ...range(435, 437),
  ...range(439, 443),
];

export const NUMBERS_SET = new Set(NUMBERS);
