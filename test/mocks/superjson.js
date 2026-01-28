// Mock implementation of superjson for e2e tests
module.exports = {
  stringify: (object) => JSON.stringify(object),
  parse: (string) => JSON.parse(string),
  serialize: (object) => ({
    json: object,
    meta: undefined,
  }),
  deserialize: (payload) => payload.json || payload,
  default: {
    stringify: (object) => JSON.stringify(object),
    parse: (string) => JSON.parse(string),
    serialize: (object) => ({
      json: object,
      meta: undefined,
    }),
    deserialize: (payload) => payload.json || payload,
  },
};
