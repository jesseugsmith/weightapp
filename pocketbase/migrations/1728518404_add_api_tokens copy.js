/// <reference path="../pb_data/types.d.ts" />

// Migration to add api_tokens collection
migrate((app) => {
  const collection = new Collection({
    "id": "api_tokens_col_ids",
    "name": "api_token",
    "type": "base",
    "system": false,
    "listRule": "@request.auth.id != '' &&  @request.auth.id = user_id",
    "viewRule": "@request.auth.id != '' && @request.auth.id = user_id",
    "createRule": "@request.auth.id != '' && @request.auth.id = user_id",
    "updateRule": "@request.auth.id != '' && @request.auth.id = user_id",
    "deleteRule": "@request.auth.id != '' && @request.auth.id = user_id",
    "fields": [
      {
        "id": "user_rel_001",
        "name": "user_id",
        "type": "relation",
        "system": false,
        "required": true,
        "presentable": false,
        "unique": false,
         "collectionId": "_pb_users_auth_",
          "cascadeDelete": true,
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": null

      },
      {
        "id": "text_name_001",
        "name": "name",
        "type": "text",
        "system": false,
        "required": true,
        "presentable": false,
        "unique": false,
         "min": 1,
          "max": 100,
          "pattern": ""
      },
      {
        "id": "text_token_001",
        "name": "token",
        "type": "text",
        "system": false,
        "required": true,
        "presentable": false,
        "unique": false,
          "min": 32,
          "max": 64,
          "pattern": ""
      },
      {
        "id": "date_last_used",
        "name": "last_used_at",
        "type": "date",
        "system": false,
        "required": false,
        "presentable": false,
        "unique": false,
        "min": "",
        "max": ""
      },
      {
        "id": "bool_active_001",
        "name": "is_active",
        "type": "bool",
        "system": false,
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "id": "date_expires_001",
        "name": "expires_at",
        "type": "date",
        "system": false,
        "required": false,
        "presentable": false,
        "unique": false,
        "min": "",
        "max": ""
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_api_tokens_token ON api_tokens (token)",
      "CREATE INDEX idx_api_tokens_user_id ON api_tokens (user_id)"
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("api_tokens");
  
  if (collection) {
    return app.delete(collection);
  }
  
  return null;
})
