/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3525142174")

  // update collection data
  unmarshal({
    "createRule": ""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3525142174")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != '' && @request.auth.id = user_id"
  }, collection)

  return app.save(collection)
})
