# Áp dụng Zama Confidential Hub vào code của bạn

Hướng dẫn map `tokens.css` (drop-in) vào `frontend/src/styles.css` hiện tại, kèm 3 patch markup cho `App.tsx` (shield badge, token dropdown, CTA kèm lý do khoá).

> Thư mục code liên kết đang ở chế độ **chỉ-đọc**, nên mình chỉ **xuất file mới ở gốc dự án** (`tokens.css`, `apply-guide.md`). Bạn tự dán vào repo theo các bước dưới.

---

## Bước 1 — Nạp tokens.css

Copy `tokens.css` vào `frontend/src/tokens.css`, rồi import **trước** `styles.css`:

```ts
// frontend/src/main.tsx
import "./tokens.css";   // <-- thêm dòng này TRƯỚC
import "./styles.css";
```

Không có gì thay đổi về giao diện ngay — bước 2 mới thực sự nối màu cũ vào biến.

---

## Bước 2 — Map hex cứng trong styles.css sang biến

`styles.css` hiện đang hardcode hex. Thay bằng biến để đồng bộ với hệ thống. Bảng map 1-1 (giá trị **không đổi**, chỉ gom về token):

| Hex cũ trong styles.css | Thay bằng | Vai trò |
| --- | --- | --- |
| `#000000` | `var(--z-canvas)` | nền app / sidebar |
| `#0d0d0d` | `var(--z-surface)` | input, dropdown, well |
| `#0b0b0b` | `var(--z-surface-1)` | panel "Surface 1" |
| `#141414` | `var(--z-panel)` | card, panel, menu ví |
| `#1b1b1b` | `var(--z-modal)` | modal, pair card |
| `#1f1f1f` / `#202020` | `var(--z-hover)` | hover fill |
| `#151515` | `var(--z-raise)` | mặt button mặc định |
| `#232323` | `var(--z-border-subtle)` | divider, rule sidebar |
| `#2b2b2b` / `#272727` | `var(--z-border)` | viền control/panel |
| `#3a3a3a` / `#333` | `var(--z-border-card)` | viền card, dropdown, avatar |
| `#6f6f6f` | `var(--z-border-hover)` | viền khi hover |
| `#f4f4f1` | `var(--z-fg)` | chữ chính |
| `#b9b9b2` / `#d8d8d1` | `var(--z-body)` | chữ phụ |
| `#9c9c95` | `var(--z-muted)` | label, metadata |
| `#7d7d76` | `var(--z-faint)` | địa chỉ, hint |
| `#ffd208` | `var(--z-accent)` | nhấn vàng Zama |
| `#050505` | `var(--z-on-accent)` | chữ trên nền vàng |
| `rgba(255,210,8,0.08)` | `var(--z-accent-tint)` | wash bước đang chạy |
| `#806b24` | `var(--z-accent-border)` | viền panel accent |
| `#315f40` / `#315f44` | `var(--z-positive-border)` | viền trạng thái ok |
| `#6f5530` | `var(--z-warn-border)` | viền wrong-network |
| `#ff8f66` | `var(--z-danger-fg)` | chữ lỗi / disconnect |

Ví dụ, khối `:root` và `button` đầu file:

```css
/* TRƯỚC */
:root { color: #f4f4f1; background: #000000; font-family: Inter, ui-sans-serif, system-ui, ...; }
button { border: 1px solid #2b2b2b; background: #151515; color: #f4f4f1; }

/* SAU */
:root { color: var(--z-fg); background: var(--z-canvas); font-family: var(--z-font); }
button { border: 1px solid var(--z-border); background: var(--z-raise); color: var(--z-fg); }
```

> Mẹo: dùng find-and-replace theo từng dòng trong bảng. Giá trị giống hệt nên không có rủi ro đổi màu; bạn chỉ đang tập trung hoá token.

Bổ sung 2 điểm nhỏ nên chuẩn hoá luôn:
- `input, select { min-height: 46px }` giữ nguyên; đảm bảo `border-radius: var(--z-r-input)` (6px).
- Thêm focus ring dùng chung: `:focus-visible { outline: 2px solid var(--z-accent); outline-offset: 2px; }`.

---

## Bước 3 — Patch markup (App.tsx)

Ba thay đổi có giá trị cao nhất so với bản hiện tại. Class giữ nguyên để không phá CSS khác.

### 3.1 — Shield badge legible trên mọi logo

Hiện `TokenShieldIcon` là 1 SVG dán trực tiếp lên avatar; trên logo sáng (ZAMA vàng, XAUt vàng kim) badge dễ chìm. Đặt badge lên **đĩa tối có viền màu nền** để luôn nổi.

```tsx
// App.tsx — TokenAvatar: bọc badge trong 1 đĩa
{confidential ? (
  <span className="token-shield-disc" aria-hidden="true">
    <TokenShieldIcon />
  </span>
) : null}
```

```css
/* styles.css — thêm */
.token-shield-disc {
  position: absolute;
  right: -5px; bottom: -5px;
  z-index: 2;
  display: grid; place-items: center;
  width: 18px; height: 18px;
  border-radius: var(--z-r-pill);
  background: var(--z-surface);
  border: 1.5px solid var(--z-canvas);          /* viền màu nền → tách khỏi logo */
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
}
.token-shield-disc .token-shield { width: 11px; height: 11px; }
/* giữ .token-avatar { overflow: visible } như hiện tại */
```

(Không cần đổi `TokenShieldIcon` — path `#FFD208` + white vẫn dùng lại nguyên vẹn, chỉ nằm trong đĩa.)

### 3.2 — CTA luôn kèm lý do khoá

Hiện các nút chính khoá bằng `disabled={actionLocked ...}` nhưng nhãn tĩnh (vd `SHIELD`), người dùng không biết vì sao. Đưa **lý do vào nhãn**. App.tsx (dòng ~189-190) đã có sẵn `account`, `isSepolia`, `actionLocked` trong scope — chỉ cần đọc lại chúng:

```tsx
// App.tsx — helper dùng chung (đặt cạnh nơi đã có `account` + `isSepolia`)
function ctaLabel(ready: string, verb: string, account: unknown, isSepolia: boolean) {
  if (!account)    return `Connect wallet to ${verb}`;
  if (!isSepolia)  return "Switch to Sepolia";
  return ready;
}

// ví dụ nút submit shield (dòng ~1747 / ~2005)
<button
  className="primary flow-submit"
  disabled={disabled}
  onClick={() => void submitShield()}
>
  {busy ? "Shielding…" : ctaLabel("Shield", "shield", account, isSepolia)}
</button>
```

Áp cùng mẫu cho Unshield (`verb: "unshield"`), Send (`"send"`), Faucet/Claim (`"mint"`), Decrypt (`"decrypt"`). Với các state đang chạy, dùng nhãn động thể hiện động từ: `Checking allowance…, Approving…, Shielding…, Requesting…, Finalizing…, Decrypting…`.

### 3.3 — Token dropdown: thêm tên đầy đủ + số dư mỗi dòng

`token-dropdown-item` hiện chỉ có avatar + symbol. Bổ sung tên và số dư để giống bản redesign (số dư mã hoá hiển thị `****`).

```tsx
// App.tsx — trong map option (dòng ~1417)
<button className={option.value === selected?.value ? "token-dropdown-item active" : "token-dropdown-item"} ...>
  <TokenAvatar token={option.token} confidential={option.confidential} />
  <span className="token-dropdown-meta">
    <span>{option.label}</span>
    <small>{option.token.name}</small>
  </span>
  {option.balance != null && (
    <span className="token-dropdown-bal">
      {option.encrypted ? "∗∗∗∗" : option.balance}
    </span>
  )}
</button>
```

```css
/* styles.css — thêm */
.token-dropdown-item { min-height: 48px; }
.token-dropdown-meta { display: grid; min-width: 0; line-height: 1.3; }
.token-dropdown-meta small { color: var(--z-muted); font-size: 11px; }
.token-dropdown-item.active .token-dropdown-meta small { color: rgba(255,210,8,0.7); }
.token-dropdown-bal { margin-left: auto; text-align: right; font-size: 12px; color: var(--z-body); font-family: var(--z-mono); }
```

---

## Bước 4 — Quy tắc bất biến (giữ khi mở rộng)

- **Một màu nhấn duy nhất** `--z-accent`, dùng tiết chế (nút chính, nav active, bước active). Đỏ/xanh chỉ là **trạng thái**, không phải nhấn thứ hai.
- **Số dư mã hoá render `****`** (mono), không bao giờ là `0` giả.
- **CTA luôn nêu lý do khoá** trên nhãn cho tới khi ví connect đúng Sepolia.
- **Token bảo mật luôn có shield badge** trên đĩa tối.
- WCAG AA: focus ring rõ, aria-label cho nút chỉ-icon, hit target ≥ 44px.

---

## Kiểm chứng nhanh sau khi dán
1. `npm run dev` — app chạy, giao diện không đổi màu (bước 2 là refactor token, không đổi giá trị).
2. Kết nối ví sai mạng → nút chính hiện "Switch to Sepolia".
3. Token bảo mật chưa decrypt → hiện `****`; badge nổi rõ trên logo ZAMA/XAUt.
4. Mở dropdown token → mỗi dòng có tên + số dư.

## Tham chiếu
- `tokens.css` — biến drop-in (nguồn của bảng map).
- `DESIGN.md` / `brand.json` — đặc tả đầy đủ + provenance.
- `components.html`, `app.css` — bản redesign tham chiếu hình dạng component.
