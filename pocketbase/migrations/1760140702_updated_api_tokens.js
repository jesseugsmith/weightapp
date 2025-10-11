/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3525142174")

  // update field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "bool1260321794",
    "name": "is_active",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3525142174")

  // update field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "bool1260321794",
    "name": "active",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
})
