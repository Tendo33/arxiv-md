/** Firefox：声明 data_collection_permissions.required = websiteContent（内置同意页；待决策），gecko 只有这三个键 */
import manifest from '../src/manifest.json';

test('data_collection_permissions', () => {
  const g = manifest.browser_specific_settings.gecko;
  expect(Object.keys(g).sort()).toEqual(['data_collection_permissions', 'id', 'strict_min_version']);
  expect(g.data_collection_permissions).toEqual({ required: ['websiteContent'] });
});
