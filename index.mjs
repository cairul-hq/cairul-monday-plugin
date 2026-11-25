import {
  check,
  bearer,
  connection,
  error,
  matchesState,
  positiveID,
  query,
  service,
  stateOption,
  text,
  verdict,
  z,
} from '@cairul/plugin-kit';

export default function monday(options) {
  const api = connection(options, {
    prefix: 'MONDAY',
    baseUrl: 'https://api.monday.com',
    tokenEnv: 'MONDAY_TOKEN',
    required: true,
    authModes: { 'api-token': (token) => ({ authorization: token }), bearer },
  });
  function column(shape, evaluate) {
    return check(z.strictObject({ item: positiveID, column: text, ...shape }), (config, { signal }) =>
      service(async () => {
        const { item, column } = config;
        const response = await query(
          api,
          'v2',
          {
            query:
              'query CairulItem($ids: [ID!]!, $columns: [String!]) { items(ids: $ids) { column_values(ids: $columns) { id text } } }',
            variables: { ids: [item], columns: [column] },
          },
          signal
        );
        if (response.errors?.length || !response.data?.items?.length)
          return error('monday.com could not resolve the item.');
        return evaluate(response.data.items[0].column_values?.[0]?.text, config);
      })
    );
  }
  return {
    checkKinds: {
      'monday.item-status': column({ state: stateOption }, (actual, { state }) => matchesState(actual, state, 'Item')),
      'monday.column-present': column({}, (actual) =>
        verdict(typeof actual === 'string' && !!actual.trim(), 'Waiting for column to be populated.')
      ),
    },
  };
}
