# API пожеланий и рейтинга (Yandex Cloud)

Сайт статический (GitHub Pages), поэтому писать в бакет напрямую из браузера нельзя — ключи утекли бы
в каждого игрока. Схема: **браузер → Cloud Function → Object Storage**. Ключ лежит только в функции.

```
игра (ndrwbv.github.io)  ──GET/POST──►  Cloud Function arbuz-api  ──S3 API──►  бакет arbuz-surfer-data
                                         (публичный вызов)                       wishes/<id>.json
                                                                                  scores/<player>.json
```

## Что создать

Нужен каталог в **личном** облаке (не корпоративном) и `yc` CLI, залогиненный в него
(`yc init` или отдельный профиль: `yc config profile create personal`).

1. **Бакет** — приватный, публичный доступ не нужен:
   ```bash
   yc storage bucket create --name arbuz-surfer-data
   ```
2. **Сервисный аккаунт** с правом писать в бакеты каталога:
   ```bash
   yc iam service-account create --name arbuz-surfer
   yc resource-manager folder add-access-binding <FOLDER_ID> \
     --role storage.editor --subject serviceAccount:<SA_ID>
   ```
3. **Статический ключ доступа** для этого аккаунта (сохрани `key_id` и `secret` — секрет показывается один раз):
   ```bash
   yc iam access-key create --service-account-name arbuz-surfer
   ```
4. **Функция** (Node.js; список рантаймов — `yc serverless function runtime list`, бери свежий `nodejs*`):
   ```bash
   yc serverless function create --name arbuz-api
   yc serverless function version create --function-name arbuz-api \
     --runtime nodejs22 --entrypoint index.handler --memory 128m --execution-timeout 10s \
     --source-path ./serverless \
     --environment BUCKET=arbuz-surfer-data,AWS_ACCESS_KEY_ID=<key_id>,AWS_SECRET_ACCESS_KEY=<secret>,ALLOW_ORIGIN=https://ndrwbv.github.io
   yc serverless function allow-unauthenticated-invoke arbuz-api
   yc serverless function get arbuz-api   # id функции
   ```
   Зависимости (`@aws-sdk/client-s3`) Yandex ставит сам из `package.json`. Секрет аккуратнее положить в
   Lockbox и передать через `--secret`, но для подарка хватит и переменной окружения.
5. **Включить в игре** — вписать адрес в [`js/config.js`](../js/config.js), закоммитить, запушить:
   ```js
   window.ARBUZ_API = 'https://functions.yandexcloud.net/<FUNCTION_ID>';
   ```

Проверка:
```bash
curl 'https://functions.yandexcloud.net/<FUNCTION_ID>?op=wishes'
curl -X POST 'https://functions.yandexcloud.net/<FUNCTION_ID>?op=wish' -d '{"name":"Тест","text":"С днём рождения!"}'
```

## Что важно знать

- **Пожелания попадают в игру без модерации.** Неудачное удаляется объектом из бакета
  (`yc storage s3api delete-object --bucket arbuz-surfer-data --key wishes/<id>.json`).
- **Рейтинг честный, пока никто не захочет обмануть**: очки считает браузер, функция лишь проверяет диапазон.
- Стоимость — копейки: бакет на килобайты, функция вызывается несколько раз за игру.
- Если `ARBUZ_API` пустой или функция недоступна, игра работает офлайн: рейтинг локальный, пожелания встроенные.
