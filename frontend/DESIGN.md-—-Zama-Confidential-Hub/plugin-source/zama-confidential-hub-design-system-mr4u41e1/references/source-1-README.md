# Zama Confidential Hub — Design System

Phiên bản: **1.1.0** · Nguồn: <https://zama-ctoken-shield.vercel.app/>

Hệ thống thiết kế cho ứng dụng **cToken của Zama** — ví và công cụ DeFi cho token bảo mật trên stack FHE / ERC-7984 (Sepolia testnet). Người dùng shield token ERC-20 công khai thành bản bảo mật, unshield ngược lại, gửi bảo mật, decrypt số dư đã mã hoá, và mint từ faucet.

Đây là một **gói (bundle) có phiên bản**: tokens → fonts → components → UI kit → provenance → asset gốc. Đủ để dựng một sản phẩm HuTML mới mà không cần hỏi lại brief.

## Bản sắc trong một đoạn

Shell tối, gần như đen (`#000000`) với **một màu nhấn duy nhất** — vàng Zama `#ffd208`. Sidebar trái cố định (Dashboard, Faucet, Shield/Unshield, Send, Activity), ví ghim ở đáy. Mọi hành động nằm trong card/form căn giữa. Token bảo mật luôn mang **shield badge**; số dư mã hoá chưa giải mã hiển thị `****`, không bao giờ là số 0 giả. Chữ Inter + mono SFMono cho địa chỉ/hash/số tiền.

## Cấu trúc file

### Đặc tả hệ thống (nguồn chân lý)
| File | Nội dung |
| --- | --- |
| `DESIGN.md` | Đặc tả đầy đủ: màu (đo được + OKLCH), typography, layout, component, voice, a11y. |
| `brand.json` | Tokens máy đọc được: palette mở rộng, type, layout, registry token, provenance. |
| `guide.md` | Hướng dẫn nhanh cách dùng hệ thống. |
| `SKILL.md` | Lens/quy trình để agent áp dụng hệ thống này khi dựng artifact mới. |

### Redesign sản phẩm (tham chiếu UI cao độ)
| File | Nội dung |
| --- | --- |
| `index.html` | App shell hoàn chỉnh + 5 view (Dashboard, Faucet, Shield/Unshield, Send, Activity) + 2 modal. |
| `app.css` | Nền tảng token + hệ component (shell, sidebar, avatar+shield, dropdown, flow card, encrypted notice, bảng asset, modal, step progress). Responsive tới 320px. |
| `app.js` | Lớp tương tác: connect ví, wrong-network, dropdown logo, flow Shield⇄Unshield với step progress, decrypt permit (`****`→giá trị), send/faucet, modal chi tiết asset. |
| `components.html` | Bảng component có state + ghi chú lý do sai khác so với app hiện tại. |

### Bundle trích xuất theo thuật toán (antd/seed)
| File | Nội dung |
| --- | --- |
| `system/seed.json` | SeedToken ~20 trường — bề mặt duy nhất được tác giả. |
| `system/tokens.{default,dark,compact}.json` | DesignTokens dẫn xuất theo từng theme. |
| `system/variables.css`, `variables.dark.css` | Biến CSS `--brand-*`. |
| `system/theme.json` | Theme antd `ConfigProvider` (đã sửa: status màu thật, base tối, controlHeight 44). |
| `system/kit.html`, `kit.dark.html` | Showcase component sáng/tối. |
| `system/index.html` | Gallery preview liên kết mọi thứ. |
| `system/artifacts/*.html` | Ví dụ tạo sẵn (landing, deck, poster, email, newsletter, form). |

### Asset gốc (không vẽ lại)
- `assets/zama-brand-icon.png` — brand mark chính.
- `assets/tokens/{usdc,usdt,weth,zama,xaut}.png` — logo token thật.
- `logos/{apple-touch-icon.png, favicon-1.png, favicon-2.ico}`.

### Bằng chứng nguồn
- `context/source-context.md`, `context/input-DESIGN.md`.
- `context/local-code/frontend/` — mã nguồn app thật (`src/styles.css`, `src/config/officialPairs.ts`, `src/lib/{prices,tokenIcons}.ts`) đã dùng để đo lại token.

## Cách dùng
1. Đọc `DESIGN.md` để nắm nguyên tắc thị giác.
2. Bind token từ `brand.json` (hoặc `system/variables.css`) vào `:root`.
3. Khớp hình dạng component với `components.html` / `app.css`.
4. Dùng `index.html` làm tham chiếu UI cao độ khi dựng màn hình mới.

## Đã cải thiện trong lần AI Optimize này
- Sửa **màu base bị đảo** (app là shell tối: canvas `#000`, chữ `#f4f4f1`).
- Thay **status màu mặc định antd** bằng màu thật của app (`#46c07a` / `#6f5530` / `#d45757`).
- Thêm **palette mở rộng đo được** (4 bậc surface, 4 bậc border, 3 bậc text, hỗ trợ accent) + giá trị **OKLCH**.
- Thay voice/imagery/posture rỗng-hoặc-lặp bằng nội dung thật; thêm **registry token** với logo thật.
- Dựng **redesign UI cao độ** (`index.html` + `app.css` + `app.js` + `components.html`).

## Hạn chế còn lại
- Redesign UI là **prototype front-end**: flow mô phỏng bằng thời gian/số dư giả, chưa nối ví/chuỗi thật.
- Chưa đo trực tiếp trên trang live (dùng mã nguồn local làm chân lý); tỉ lệ contrast của nhấn vàng cho chữ nhỏ được đánh dấu *inferred*.
- `system/kit*.html`, `system/artifacts/*` vẫn ở dạng do engine sinh; chưa đồng bộ hoàn toàn với palette mở rộng mới.
