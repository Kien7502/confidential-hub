# Tiến trình dự án

## Đã làm

- Đọc các file hiện có trong repo, bỏ qua `tham khảo repo` theo yêu cầu.
- Xác nhận `contract/` và `frontend/` hiện chưa có file.
- Đọc `docs/challenge.md` và đã tổng hợp các file yêu cầu riêng của user vào rules/docs hiện tại.
- Xem wireframe `wireframe của tôi.webp`.
- Lấy nội dung Markdown cần thiết từ Zama docs:
  - Sepolia addresses.
  - Confidential Wrapper Registry.
  - Confidential Wrapper.
  - SDK/sitemap để xác định các hook/API liên quan.
  - Relayer SDK README.
- Tạo rules chung cho agent trong `AGENTS.md`.
- Tạo rule file phụ trong `.agents/rules/project-rules.md`.
- Tạo skill nội bộ `.agents/skills/zama-wrapper-registry/SKILL.md`.
- Tạo reference cho skill tại `.agents/skills/zama-wrapper-registry/references/zama-wrapper-reference.md`.
- Tạo cache ghi chú docs tại `docs/zama-docs-notes.md`.
- Hoàn tất nền tảng phối hợp để nhiều agent có thể chia việc frontend, Zama integration, contract/config, QA/docs.
- Khảo sát `https://app.zama.org/` và lưu dữ liệu UI/route vào `docs/zama-app-notes.md`.

## Đang làm

- Không có task coding đang mở trong lượt này.

## Sẽ làm

- Hoàn thiện kiểm tra build/test sau khi cài dependencies.
- Kiểm tra thủ công wallet/Sepolia khi có ví testnet và ETH Sepolia.

## Hoàn tất trong lượt triển khai này

- Tạo `frontend/` bằng Vite React TypeScript.
- Thêm constants Sepolia, Wrappers Registry, official cTokenMock pairs, local pair config và minimal ABIs.
- Thêm registry loader đọc onchain registry, fallback official docs list, merge local config và kiểm tra validity.
- Thêm app shell sidebar Zama-style với Dashboard, Shield, Unshield, Faucet, Decrypt, Activity, Add/Create.
- Thêm faucet mint, approve + wrap, unwrap request/finalize shell, decrypt handle cache và local activity storage.
- Thêm README submission với run/build/deploy/demo checklist/known limitations.
- Thêm unit tests cho amount conversion, faucet limit, decrypt cache key và registry merge.
- Cài dependencies, tạo `package-lock.json`, chạy `npm test` thành công với 5 tests.
- Chạy `npm run build` thành công; còn warning chunk lớn do Relayer SDK/WASM.
- Khởi động dev server tại `http://127.0.0.1:5174/` vì port 5173 đang được dùng.

## Hoàn tất trong lượt setup test

- Thêm `frontend/.env.test.local.example` cho private key/RPC/pair/amount và cờ bật transaction.
- Thêm `frontend/.gitignore` để loại `node_modules`, `dist`, build info, vite logs và `.env.*.local`.
- Thêm script `npm run test:sepolia` chạy `scripts/sepolia-smoke.mjs`.
- Smoke script read-only kiểm tra RPC Sepolia, ETH balance, registry mapping, wrapper validity, metadata, rate, balance và confidential handle.
- Khi `SEPOLIA_ENABLE_TXS=true`, smoke script mint faucet token, approve wrapper nếu cần, wrap token và đọc handle sau wrap.
- Xác nhận `npm test` và `npm run build` vẫn pass sau setup test.
- Xác nhận `npm run test:sepolia` fail có kiểm soát khi chưa có `.env.test.local`/`SEPOLIA_PRIVATE_KEY`.

## Hoàn tất smoke test Sepolia

- Bật `SEPOLIA_ENABLE_TXS=true` trong `.env.test.local` để chạy tx smoke theo yêu cầu.
- Chạy `npm test`: pass 2 files / 5 tests.
- Chạy `npm run build`: pass, chỉ còn warning chunk lớn do SDK/WASM.
- Chạy `npm run test:sepolia`: pass registry/RPC/gas/pair metadata/faucet mint/approve/wrap/handle read.
- Tx faucet mint: `0x9c973f8a7e187eb8dc440be32367e81fdfabd3e180d275100c4da5a6505ad73b`.
- Tx approve: `0x4e0c9fdf541dbe25ff0e3f16b4499ba676367de2902329cc06f43fabfbfba244`.
- Tx wrap: `0x0da0f530dcd0059b386be9120f7eba6eac52b06819160c7f12b5c7b8085735b7`.
- Xác nhận app dev server `http://127.0.0.1:5174/` trả HTTP 200.
- Ghi báo cáo tại `docs/test-report.md`.
- Thử SDK Node để tự động hóa decrypt/unwrap proof nhưng `createInstance` fail tại Zama relayer `KEY_URL` với `fetch failed`, kể cả khi chạy escalated; cần manual browser test hoặc provider test tương thích SDK.

## Hoàn tất sửa lỗi SDK failed

- Sửa `frontend/src/lib/sdk.ts` để app boot chỉ chạy `initSDK()` và không gọi `createInstance()` ngay khi load trang.
- Thêm `createZamaInstance()` để decrypt/unwrap tạo relayer instance lazy khi người dùng thực hiện action cần SDK.
- Sửa `frontend/src/App.tsx` để dùng lazy SDK instance và chuyển `Uint8Array` handle/proof từ SDK sang hex trước khi gửi transaction.
- Chạy lại `npm test`: pass 2 files / 5 tests.
- Chạy lại `npm run build`: pass, chỉ còn warning chunk lớn do SDK/WASM.
- Xác nhận dev server `http://127.0.0.1:5174/` trả HTTP 200.

## Hoàn tất tích hợp Privy wallet connect

- Cài `@privy-io/react-auth` bằng npm với `--legacy-peer-deps` do peer conflict `ox` giữa Privy/wagmi/viem.
- Bọc app bằng `PrivyProvider` trong `frontend/src/main.tsx`, dark theme, yellow accent, wallet-only login và Sepolia-only chain config.
- Thêm `frontend/.env.example` với `VITE_PRIVY_APP_ID`.
- Thêm guard hiển thị cấu hình thiếu nếu chưa có `frontend/.env.local`.
- Sửa `frontend/src/App.tsx` dùng `usePrivy()` và `useWallets()` thay cho wallet injected tự viết.
- Sửa transaction helpers nhận EIP-1193 provider lấy từ `wallet.getEthereumProvider()` của Privy.
- Shield, Faucet, Unshield và Decrypt hiện dùng Privy provider cho viem/Zama SDK.
- Chạy `npm test`: pass 2 files / 5 tests.
- Chạy `npm run build`: pass; có warning từ Privy package annotations và SDK/WASM chunks.

## Hoàn tất sửa SDK failed sau Privy

- Bỏ boot-time `initializeZamaSdk()` khỏi `App`, tránh header báo `SDK failed` khi SDK/relayer/WASM chưa cần dùng.
- Thêm trạng thái `SDK lazy` vào `SdkState`; header hiển thị SDK ở chế độ lazy thay vì fail.
- Gỡ lock `sdkReady` khỏi Decrypt/Unshield để các action tự khởi tạo SDK khi thật sự cần.
- Giữ `createZamaInstance()` là nơi init SDK thật và trả lỗi cụ thể trong action nếu relayer/decrypt/unwrap lỗi.
- Chạy `npm test`: pass 2 files / 5 tests.
- Chạy `npm run build`: pass; còn warning từ Privy annotations và SDK/WASM chunks.

## Hoàn tất sửa race approve/wrap

- Tách `approveIfNeeded` thành `readAllowance`, `approveToken`, `waitForTransactionSuccess` trong `frontend/src/lib/transactions.ts`.
- Shield flow giờ đọc allowance trước khi làm gì với wrapper.
- Nếu allowance thiếu, app gửi approve, đợi receipt success, đọc lại allowance, chỉ khi allowance đủ mới gọi `wrap`.
- Thêm trạng thái nút `Checking allowance`, `Approving`, `Shielding` để user không tương tác sai trong lúc approve pending.
- Chạy `npm test`: pass 2 files / 5 tests.
- Chạy `npm run build`: pass; còn warning từ Privy annotations và SDK/WASM chunks.

## Hoàn tất sửa hiển thị cToken balance

- Dashboard token row giờ đọc ciphertext handle bằng `confidentialBalanceOf` và hiển thị rõ `loading`, `encrypted`, `0 SYMBOL`, `handle error`, hoặc số dư đã decrypt/cache theo decimals của cToken.
- Nút decrypt trong row cToken giờ chạy Zama `userDecrypt` thật bằng Privy provider, lưu cache theo wallet/chain/token/handle và ghi activity success/fail.
- Trang Decrypt tự chọn cToken đầu tiên khi registry load xong, format kết quả decrypt/cache theo metadata của token thay vì chỉ hiển thị raw integer.
- Chạy `npm test`: pass 2 files / 5 tests.
- Chạy `npm run build`: pass; còn warning từ Privy annotations và SDK/WASM chunks.

## Hoàn tất sửa permit prompt khi decrypt cToken

- Tách bước ký permit user decrypt thành `signUserDecryptPermit()` trong `frontend/src/lib/sdk.ts`.
- Flow decrypt giờ tạo SDK keypair và gọi `eth_signTypedData_v4` trước khi gọi `createZamaInstance()`, tránh việc relayer public-key fetch lỗi/kẹt làm ví không hiện prompt ký.
- Bổ sung type declaration cho `generateKeypair` và `createEIP712` của `@zama-fhe/relayer-sdk/web`.
- Chạy `npm test`: pass 2 files / 5 tests.
- Chạy `npm run build`: pass; còn warning từ Privy annotations và SDK/WASM chunks.

## Hoàn tất sửa click decrypt im lặng

- Dùng `useSignTypedData()` của Privy cho ví embedded `privy`/`privy-v2`; ví ngoài vẫn fallback qua EIP-1193 `eth_signTypedData_v4`.
- Truyền signer xuống Dashboard row và trang Decrypt để prompt ký permit mở bằng cơ chế modal của Privy.
- Nút decrypt trong token row không còn fail im lặng: nếu thiếu wallet/provider/handle hoặc zero handle, UI hiển thị lý do ngay cạnh nút.
- Thêm trạng thái `Signing permit` và `Decrypting` cho row cToken và trang Decrypt.
- Chạy `npm test`: pass 2 files / 5 tests.
- Chạy `npm run build`: pass; còn warning từ Privy annotations và SDK/WASM chunks.

## Hoàn tất sửa lỗi `global is not defined`

- Thêm Vite `define.global = "globalThis"` và optimizeDeps esbuild define để browser bundle xử lý dependency còn tham chiếu biến Node `global`.
- Thêm shim sớm trong `frontend/index.html` trước module app: `window.global = window.globalThis`.
- Chạy `npm test`: pass 2 files / 5 tests.
- Chạy `npm run build`: pass; còn warning từ Privy annotations và SDK/WASM chunks.
- Restart dev server repo này tại `http://127.0.0.1:5174/`; HTTP 200 và log Vite không có stderr.

## Hoàn tất dashboard/flow update

- Thêm metadata icon cho token official và token user nhập bằng `iconUrl`, hỗ trợ `https://` và `ipfs://`.
- Tách logic xây dashboard rows để ERC20 user nằm bên trái, cToken wrapper user nằm bên phải, và pair đầy đủ được merge đúng hàng.
- Rework Shield/Unshield thành layout stacked card theo spec Zama: `You shield` / `You receive`, selector bên phải, amount lớn, balance footer và button full width.
- Sửa lại theo clarification: dấu cộng trái/phải chỉ mở Add/Create token tương ứng, không điều hướng Shield/Unshield.
- Dấu cộng bên phải ERC20 mở Create wrapper và prefill underlying; dấu cộng bên trái cToken wrapper mở Add ERC20 và prefill underlying address nếu biết.
- Nút giữa là entry duy nhất để vào Shield/Unshield: row có ERC20 đi Shield, row chỉ có cToken wrapper đi Unshield.
- Shield/Unshield hiện nhận cả official pairs và user-added pairs; ERC20 chưa có wrapper không gửi transaction sai.
- Sửa flow intent để bấm nút giữa của một row sẽ preselect đúng cặp token đó trên Shield/Unshield, kể cả khi pair list load lại sau khi chuyển trang.
- Sửa danh sách Shield/Unshield bị duplicate khi user add ERC20 rồi add/deploy wrapper cToken cho cùng underlying; Shield ưu tiên pair complete/actionable thay vì placeholder ERC20-only.
- Gộp Shield và Unshield thành một màn `Shield / Unshield`, bỏ tab/nav Unshield riêng.
- Thêm nút đổi chiều nằm giữa hai token cards để đảo từ Shield sang Unshield và ngược lại, giữ cặp token đang chọn nếu cặp đó hỗ trợ cả hai chiều.
- Thay badge cToken dạng chữ `c` bằng SVG shield kiểu Zama và cho badge nổi ra ngoài token avatar thay vì bị crop.
- Thêm unit tests cho token icon resolver và dashboard row merge/routing.
- Chạy lại `npm test`: pass 4 files / 16 tests.
- Chạy lại `npm run build`: pass; còn warning từ Privy annotations và SDK/WASM chunks.
- Xác nhận dev server `http://127.0.0.1:5174/` trả HTTP 200.

## Hoàn tất sửa hiển thị balance chưa giải mã

- Sửa cToken balance chưa có handle hoặc chưa decrypt để hiển thị `****`, không hiển thị `0`.
- Chỉ hiển thị `0 SYMBOL` khi ciphertext handle là zero handle hoặc kết quả decrypt cache thật sự là `0`.
- Áp dụng cho Dashboard rows, standalone cToken, Shield / Unshield flow và Send flow.

## Hoàn tất dọn header status

- Bỏ các pill trạng thái kỹ thuật `SDK lazy`, `Privy`, `Sepolia` khỏi topbar.
- Giữ lại nút connect/disconnect wallet và nút switch network khi wallet đang sai chain.

## Hoàn tất gỡ mock local pair

- Xóa cặp local example `LOCAL/cLOCAL` khỏi `frontend/src/config/localPairs.ts`.
- Giữ cơ chế local pair config nhưng mặc định là mảng rỗng để Dashboard/Shield không còn hiển thị mock data.

## Hoàn tất chỉnh nút decrypt cạnh balance

- Đưa nút `Decrypt` vào cùng dòng với `Balance` trong token row.
- Thu nhỏ nút decrypt để phù hợp với metadata row và không chiếm cell riêng.

## Hoàn tất sửa Add/Create token và cancel mint

- Modal Add/Create chỉ còn hai tab Add existing và Create new; Add chỉ còn ERC20 hoặc ERC7984/cToken wrapper, không còn regular/standalone confidential option.
- Create new chỉ còn ERC20 public underlying hoặc ERC7984 wrapper; bỏ deploy standalone confidential token khỏi UI/flow.
- Dấu cộng bên phải hàng ERC20 giờ mở Add ERC7984 wrapper thay vì mặc định Create wrapper.
- Khi create wrapper, name/symbol confidential token tự điền theo dạng c + underlying token nếu chọn underlying từ danh sách.
- Added tokens được dedupe theo address, add lại cùng address sẽ update metadata thay vì tạo dòng lặp.
- Faucet/create transaction cancellation được format thành Transaction was cancelled và faucet hiển thị lỗi inline.
- Chạy npm test: pass 4 files / 16 tests.
- Chạy npm run build: pass; còn warning chunk/PURE annotation từ Privy/Zama dependencies.

## Hoan tat sua cache decrypt balance
- Dashboard cToken row doc handle onchain hien tai, so voi decrypt cache theo chain/wallet/token/handle; neu handle chua doi thi hien thi balance da decrypt va khoa nut Decrypted de khong bat ky lai.

## Hoan tat cap nhat app icon Zama
- Kiem tra asset icon/logo tren `https://app.zama.org/`; web render thay `logo-black`/`logo-white` nhung local download bi Vercel Security Checkpoint.
- Dung fallback GitHub tu `zama-ai/dapps` cho favicon Zama ERC7984 example: chu Z den tren nen vang.
- Them `favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` va `site.webmanifest`; `index.html` tro sang PNG icon moi.
- Tai token icons local cho USDC, USDT, WETH, XAUt tu TrustWallet GitHub assets va dung Zama fallback icon cho ZAMA/cZAMA; resolver tro ve `/tokens/*.png` de khong phu thuoc remote runtime.
- Chay npm test: pass 4 files / 16 tests.
- Chay npm run build: pass; con warning chunk/PURE annotation tu Privy/Zama dependencies.

## Hoan tat cap nhat Shield stepper/result
- Shield flow hien thi tien trinh 1/2 Allowance va 2/2 Shield ben duoi nut submit, gom waiting/active/done/skipped/error.
- Shield flow doi receipt success cho approve va wrap truoc khi danh dau hoan tat.
- Sau khi shield thanh cong, hien panel ket qua voi tab Result/On-chain, so tien shield/receive va link Sepolia Etherscan cho approve/wrap transaction.
- Activity transaction link dung chung helper Sepolia Etherscan voi panel ket qua.
- Chay npm test: pass 4 files / 16 tests.
- Chay npm run build: pass; con warning chunk/PURE annotation tu Privy/Zama dependencies.
- Khoi dong dev server tai `http://127.0.0.1:5174/`; HTTP 200, log Vite khong co stderr.

## Hoan tat don gian hoa Add/Create token form
- Add token bo truong Label va Icon URL; form chi con category, address, ket qua doc metadata va token list.
- Create ERC20 bo truong Icon URL va decimals; decimals co dinh mac dinh la 18.
- Initial mint dung placeholder xam `1000000`; neu user de trong thi dung mac dinh nay, neu nhap so moi thi deploy theo so user nhap.
- Chay npm test: pass 4 files / 16 tests.
- Chay npm run build: pass; con warning chunk/PURE annotation tu Privy/Zama dependencies.

## Hoan tat doi Dashboard sang Wallet screen
- Dashboard doi sang layout wallet theo wireframe: total balance card, CTA Shield, header Asset/Price/Balance/Value va danh sach asset clickable.
- Asset row doc public ERC20 balance on-chain, doc confidential handle va dung cache decrypt neu co de tinh hien thi balance/value; khong tu bat wallet prompt.
- Them popup Asset Detail voi price/total balance, row Confidential co UNSHIELD, row Standard co SHIELD va nut Send.
- Them Show empty assets toggle va nut Add token trong wallet list.
- Chay npm test: pass 4 files / 16 tests.
- Chay npm run build: pass; con warning chunk/PURE annotation tu Privy/Zama dependencies.

## Hoan tat thay gia co dinh bang live token price
- Kiem tra `https://app.zama.org/` nhung curl bi Vercel Security Checkpoint nen khong lay duoc bundle public de doi chieu truc tiep.
- Them loader gia USD tu CoinGecko simple price API cho USDC, USDT, WETH, XAUt va ZAMA; cToken mock duoc normalize ve underlying symbol.
- Dashboard price/value/total balance/available to shield dung live price query cache 60 giay thay vi hang so `$0.999`.
- Token khong co price mapping hien `-` o cot price va khong bi tinh sai vao USD total; empty asset dung raw token balance de an/hien.
- Chay npm test: pass 5 files / 18 tests.
- Chay npm run build: pass; con warning chunk/PURE annotation tu Privy/Zama dependencies.

## Hoan tat sua logic empty asset
- Wallet asset list chi dua token vao Show empty assets khi balance da doc xong va chac chan public balance bang 0, confidential handle zero/khong co.
- Confidential token co non-zero handle nhung chua decrypt van hien trong danh sach chinh, tranh an nham balance dang ma hoa.
- Neu public/confidential balance chua doc duoc thi giu asset visible thay vi coi la empty.
- Chay npm test: pass 5 files / 18 tests.
- Chay npm run build: pass; con warning chunk/PURE annotation tu Privy/Zama dependencies.

## Hoan tat dua anh Zama ve local
- Kiem tra `https://app.zama.org/` thay co logo asset Next static, nhung tai truc tiep bi 429/Vercel Security Checkpoint nen khong luu file HTML gia dang SVG vao app.
- Dung fallback official GitHub `zama-ai/dapps` de lay `packages/erc7984example/public/favicon.png` va luu thanh `frontend/public/zama-brand-icon.png`.
- Sidebar brand mark dung anh local `/zama-brand-icon.png`; da xoa clone tam sau khi copy asset.
- Chay npm test: pass 5 files / 18 tests.
- Chay npm run build: pass; con warning chunk/PURE annotation tu Privy/Zama dependencies.


## Hoan tat chinh Dashboard/Shield/Activity
- Dashboard asset list chia lai thanh 2 tab: Your custom asset va Official token; empty toggle tinh theo tab dang xem.
- Token khong co price hien value la `-` thay vi `$0.00`, con tong portfolio van bo qua token khong co price.
- Shield progress chi hien khi transaction dang processing; hien Allowance truoc, den khi wrap moi hien them Shield.
- Activity khong ghi va khong hien lich su decrypt; activity decrypt cu trong localStorage bi loc khoi UI.
- Balance confidential chua decrypt hien `**** SYMBOL` de van thay cToken symbol.
- Cap nhat expectation token icon test theo asset local hien tai `/tokens-icon/USDC.svg`.
- Chay npm run build: pass; con warning chunk/PURE annotation tu Privy/Zama dependencies.
- Chay npm test: pass 5 files / 18 tests.
