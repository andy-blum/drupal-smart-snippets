import { Engine } from "php-parser";

export default new Engine({
  parser: {
    locations: true,
    extractDoc: true,
    suppressErrors: true,
  },
  ast: {
    withPositions: true,
    withSource: true
  }
});
