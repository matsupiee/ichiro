# バックエンド実装ルール

以下のルールに従ってバックエンドを実装すること。

## ディレクトリ構成

### 基本方針

権限管理を単純かつ安全にするため、APIルートを利用者の種別ごとに完全に分離する。

```txt
packages/api/src
├── routers
│   ├── index.ts
│   ├── consumer       # 一般ユーザー向けAPI
│   └── admin          # 管理者向けAPI
├── shared             # 複数のAPIで共通して使用する重要なドメインロジック
└── third-party-lib    # DB・決済・メール送信などの外部サービスクライアントの定義（ロジックなどは書かない）
```

利用者種別ごとにルートを分離することで、認証・認可の設定漏れを防ぎ、各APIが誰のためのものかを明確にする。

ネストを深くさせないようにように注意する

```
.
└── consumer/
    └── user/
        ├── profile/
        │   ├── get
        │   └── update
        └── verify-phone/
            ├── confirm
            └── request
```

consumer / admin の配下は1階層だけにする

```
.
└── consumer/
    └── user/
        ├── get-profile
        ├── update-profile
        ├── confirm-phone-number
        └── request-phone-number
```

## APIルートの構成

1つのAPIルートにつき、1つのディレクトリを作成する。

各APIディレクトリに置けるファイルは、原則として次の3ファイルのみとする。

```txt
route.ts
handler.ts
handler.integration.test.ts
```

それぞれの責務は次のとおり。

- `route.ts`

  - HTTPメソッドやパスの定義
  - procedureの選択
  - input / output schemaの定義
  - APIエラーの定義
  - handlerの登録

- `handler.ts`

  - APIの具体的な処理
  - DBアクセス
  - APIレスポンスへの変換
  - exportする関数名は必ず `handler` にする

- `handler.integration.test.ts`

  - handlerの統合テスト

### 構成例

```txt
.
└── routers/
    ├── index.ts
    └── fan/
        ├── application/
        │   └── submit/
        │       ├── route.ts
        │       ├── handler.ts
        │       └── handler.integration.test.ts
        └── event/
            └── list/
                ├── route.ts
                ├── handler.ts
                └── handler.integration.test.ts
```

## `index.ts`の配置

`index.ts`を置ける場所は、次の箇所に限定する。

```txt
packages/api/src/routers/index.ts
```

中間ディレクトリや各APIディレクトリには`index.ts`を置かない。

```txt
# 置かない例
routers/fan/event/index.ts
routers/fan/event/get/index.ts
```

不要なre-exportを避け、import元と実装ファイルの対応を明確にするためである。

## `appRouter`への登録

すべての`route.ts`は`routers/index.ts`から import し、`appRouter`へ登録する。登録しないルートは残さず削除する。

利用者種別をまたいで同じexport名を持つルートがある場合、誤って別種別のルートをimportしても型チェックは通ってしまう。
そのため、名前が衝突するルートは import 時に利用者種別を先頭につけて区別する

```ts
import { listEventsRoute as consumerListEventsRoute } from "./consumer/event/list/route";
import { listEventsRoute as adminListEventsRoute } from "./admin/event/list/route";
```

未登録の`route.ts`は`bun run check:patterns`が検出する。

## `route.ts`の書き方

### APIインターフェースの型定義

各APIの`route.ts`で、input schemaとoutput schemaを明示的に定義する。
Prismaが自動生成する型をそのままAPIのinputまたはoutputとして使用しない。DB側の変更がそのままAPIの破壊的変更になることを防ぐためである。
API間でinput / output型を無理に共有する必要はない。似た形のレスポンスであっても、別のAPIである以上、将来それぞれが独立して変更される可能性があるためである。

### 変数名

```
ルート名 + { InputSchema | OutputSchema | Route }
```

例えば、event/get という API であれば以下のように定義する

```ts
const eventGetInputSchema = z.object({..});

const eventGetOutputSchema = z.object({..});

export const eventGetRoute = ...
```

## `handler.ts`の書き方

### 関数名

`handler.ts`がexportする関数名は、APIルートによらず必ず`handler`にする。

```ts
// fan/event/list/handler.ts
export async function handler({ input, context }) {
  // ...
}
```

```ts
// fan/event/list/route.ts
import { handler } from "./handler";

export const eventListRoute = publicProcedure
  .input(eventListInputSchema)
  .output(eventListOutputSchema)
  .handler(handler);
```

`listEventsHandler`のようにルート名を関数名へ繰り返さない。ディレクトリのパスがそのままAPIルートを表しており、
関数名に同じ情報を持たせても増えるのは改名時の修正箇所だけであるためである。

別ディレクトリのhandlerをテストのセットアップなどでimportする場合は、importする側でaliasを付ける。

```ts
import { handler as upsertPerformanceHandler } from "../upsert-performance/handler";
```

## 統合テスト

すべての`handler.ts`について、同じディレクトリに統合テストを作成する。

```txt
.
└── application/
    └── submit/
        ├── route.ts
        ├── handler.ts
        └── handler.integration.test.ts
```

詳細は docs/coding-pattern/test.md を参照。

## `shared`の役割

`shared`には、複数のAPIで共通して使用する、重要性の高いドメインロジックを配置する。

次のような処理が対象となる。

- 実装が分散するとデータ整合性が崩れる処理
- 複数のAPIで同じ判定結果に統一する必要がある処理
- 金額・在庫・権限・状態遷移などの重要な計算や判定

### `shared`に置かない処理

API固有のレスポンス変換や、そのAPIでしか使用しない小さな処理は、原則として`handler.ts`内に記述する。
例えば、次のような処理はAPI固有の表示形式への変換であり、データ整合性を担保するドメインロジックではないため、無理に共通化しない。

```ts
function toCustomerEventDetail(event: EventForPresenter) {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    eventOrganizerName: event.organizer?.name ?? "主催者未設定",
    location: event.performances[0]?.venue.name ?? "会場未定",
  };
}
```

ただし、同じレスポンス変換が複数APIで必要になった場合は、API設計そのものに重複がないかを先に確認する。

## `shared`のファイル構成

`shared`配下は、ドメインの関心ごとにディレクトリを分ける。

```txt
.
└── shared/
    ├── event/
    │   ├── calculate-event-sales.ts
    │   └── get-event-tags.ts
    └── application/
        └── validate-application-limit.ts
```

ファイルは、原則として1ファイルにつき1つの関数だけをexportする。
ファイル名とexportする関数名は一致させる。

```ts
// calculate-event-sales.ts
export function calculateEventSales() {
  // ...
}
```

1つのファイルから多数の関数をexportする、用途の曖昧なユーティリティファイルは作らない。

```txt
# 避ける
shared/utils.ts
shared/helpers.ts
shared/common.ts
```

また、似た役割の関数を増やしすぎないようにする。
似た役割の関数が乱立するとそれぞれの違いがわからなくなり、混乱が生まれてしまうためである。

```txt
calculate-event-sales.ts
calc-event-sales.ts
get-event-sales.ts
build-event-sales.ts
```

同じ概念を扱う関数がすでに存在する場合は、新しい関数を追加する前に既存処理へ統合できないか確認する。

## APIルートの作成

### procedureの選択

APIの利用者と必要な権限に応じて、適切なprocedureを選択する。

特に、次のような認可漏れを起こさないこと。

- 管理者向けAPIを一般ユーザーが実行できる
- 認証必須のAPIを未認証ユーザーが実行できる

### APIの重複

同じ利用者向けに、同じ役割のAPIが重複して存在しないか確認する。似たAPIが増えると、どれを使用すべきか分かりにくくなり、仕様差分も発生しやすいためである。

## 判断に迷った場合

処理をどこに配置するか迷った場合は、次の順番で判断する。

1. そのAPIでしか使用しない処理か

   - `handler.ts`に置く

2. 複数APIで使用する処理か

   - API設計の重複がないか確認する

3. 実装が分散するとデータ整合性が崩れるか

   - `shared`に置く

4. 単にコードを短くしたいだけか

   - 無理に共通化しない
