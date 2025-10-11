/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3525142174")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != '' && @request.auth.id = user_id",
    "deleteRule": "@request.auth.id != '' && @request.auth.id = user_id",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_Rd0aL5w66a` ON `api_tokens` (`token`)",
      "CREATE INDEX `idx_ZjXd4YDYuK` ON `api_tokens` (`user_id`)"
    ],
    "listRule": "@request.auth.id != '' && @request.auth.id = user_id",
    "updateRule": "@request.auth.id != '' && @request.auth.id = user_id",
    "viewRule": "@request.auth.id != '' && @request.auth.id = user_id"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "cascadeDelete": true,
    "collectionId": "_pb_users_auth_",
    "hidden": false,
    "id": "relation2809058197",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "user_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1579384326",
    "max": 0,
    "min": 0,
    "name": "name",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1597481275",
    "max": 64,
    "min": 32,
    "name": "token",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "date1644068338",
    "max": "",
    "min": "",
    "name": "last_used_at",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "bool1260321794",
    "name": "active",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "date261981154",
    "max": "",
    "min": "",
    "name": "expires_at",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3525142174")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "indexes": [],
    "listRule": null,
    "updateRule": null,
    "viewRule": null
  }, collection)

  // remove field
  collection.fields.removeById("relation2809058197")

  // remove field
  collection.fields.removeById("text1579384326")

  // remove field
  collection.fields.removeById("text1597481275")

  // remove field
  collection.fields.removeById("date1644068338")

  // remove field
  collection.fields.removeById("bool1260321794")

  // remove field
  collection.fields.removeById("date261981154")

  return app.save(collection)
})
