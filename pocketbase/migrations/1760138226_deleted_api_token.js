/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("api_tokens_col_ids");

  return app.delete(collection);
}, (app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != '' && @request.auth.id = user_id",
    "deleteRule": "@request.auth.id != '' && @request.auth.id = user_id",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": true,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "user_rel_001",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "user_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_name_001",
        "max": 100,
        "min": 1,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_token_001",
        "max": 64,
        "min": 32,
        "name": "token",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "date_last_used",
        "max": "",
        "min": "",
        "name": "last_used_at",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "bool_active_001",
        "name": "is_active",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "date_expires_001",
        "max": "",
        "min": "",
        "name": "expires_at",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      }
    ],
    "id": "api_tokens_col_ids",
    "indexes": [
      "CREATE UNIQUE INDEX idx_api_tokens_token ON api_tokens (token)",
      "CREATE INDEX idx_api_tokens_user_id ON api_tokens (user_id)"
    ],
    "listRule": "@request.auth.id != '' &&  @request.auth.id = user_id",
    "name": "api_token",
    "system": false,
    "type": "base",
    "updateRule": "@request.auth.id != '' && @request.auth.id = user_id",
    "viewRule": "@request.auth.id != '' && @request.auth.id = user_id"
  });

  return app.save(collection);
})
