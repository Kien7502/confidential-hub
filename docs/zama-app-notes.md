# Ghi chú khảo sát app.zama.org

Ngày khảo sát: 2026-07-01.

Nguồn:
- https://app.zama.org/
- https://app.zama.org/activity
- https://app.zama.org/shield
- https://app.zama.org/unshield
- https://app.zama.org/send
- https://app.zama.org/earn
- https://app.zama.org/earn/ethereum/0xbEEF00A59B577423653A1526c7009bdE103F542B/steakhouse-confidential-prime-usdc

## Lưu ý truy cập

- `curl.exe` và `Invoke-WebRequest` từ local bị Vercel Security Checkpoint, chỉ trả về trang xác minh trình duyệt.
- Web browser fetch lấy được HTML render của app, nên dữ liệu dưới đây được rút từ nội dung render public.
- Một số phần phụ thuộc wallet hoặc môi trường SDK chỉ hiện `Initializing` hoặc yêu cầu `Connect wallet`.
- Asset logo/icon trên `app.zama.org` có thể thấy trong render Next static, nhưng tải trực tiếp bị chặn; khi cần dùng local app nên lấy fallback từ official GitHub Zama thay vì giữ HTML checkpoint.

## App shell

Title:

`Zama App - The easiest way to use confidential tokens`

Navigation chính:

- Dashboard
- Activity
- Shield
- Unshield
- Send
- Earn

Link/phần phụ:

- `Stake your ZAMA` trỏ tới `https://staking.zama.org/?utm_medium=sidebar&utm_source=zama-super-app`
- `Get Help`
- `Privacy`
- `Connect wallet`
- `Toggle Sidebar`

Ghi chú: ở một số route, sidebar hiển thị `Earn Coming soon`; nhưng route `/earn` vẫn render được trang Vaults.

## Dashboard

URL: `https://app.zama.org/`

Nội dung render khi chưa connect wallet:

- Sidebar/nav như trên.
- `Connect wallet`.
- `Initializing`.
- `Please wait while we set up your environment...`

Ý nghĩa cho app mình:

- Nên có trạng thái khởi tạo SDK riêng trước khi hiển thị dữ liệu.
- Nên giữ nút connect wallet luôn hiện ở shell.

## Activity

URL: `https://app.zama.org/activity`

Nội dung render khi chưa connect wallet:

- Sidebar/nav như trên.
- `Connect wallet`.
- `Initializing`.
- `Please wait while we set up your environment...`

Ý nghĩa cho app mình:

- Có thể thêm trang Activity/log giao dịch cho wrap, unwrap, decrypt, faucet.
- Khi chưa sẵn sàng SDK/wallet, dùng trạng thái loading thống nhất với dashboard.

## Shield

URL: `https://app.zama.org/shield`

Heading và copy:

- `Shield Tokens`
- `Shield ERC-20 tokens into their confidential counterpart.`

Form labels/states:

- `You shield`
- `Select token`
- `Connect your wallet to see your balance`
- `You receive`
- `—`
- `0.00`
- `Connect wallet`

Ý nghĩa cho app mình:

- Wrap flow nên dùng framing `You shield` -> `You receive`.
- Token selector cần hiển thị balance nếu ví đã connect.
- Nếu chưa connect wallet, không hiện balance giả; dùng copy rõ ràng.

## Unshield

URL: `https://app.zama.org/unshield`

Heading và copy:

- `Unshield Tokens`
- `Unshield confidential tokens back to their ERC-20 form.`

Form labels/states:

- `You unshield`
- `Select token`
- `Connect your wallet to see your balance`
- `You receive`
- `—`
- `0.00`
- `Connect wallet`

Ý nghĩa cho app mình:

- Unwrap flow nên dùng framing `You unshield` -> `You receive`.
- Cần hiển thị rõ confidential input token và ERC-20 output token.
- Vì challenge cần finalize unwrap, app mình nên thêm trạng thái pending/resume mà Zama App không lộ ở pre-wallet render.

## Send

URL: `https://app.zama.org/send`

Heading và copy:

- `Send Tokens`
- `Send confidential tokens to another address.`

Form labels/states:

- `Amount`
- `Select token`
- `Connect your wallet to see your balance`
- `To`
- `Connect wallet`

Ý nghĩa cho app mình:

- Dù challenge không bắt buộc send, có thể tham khảo layout cho decrypt arbitrary token và transfer cToken về sau.
- Form nên tách rõ amount, token selector, recipient.

## Earn / Vaults

URL: `https://app.zama.org/earn`

Heading và copy:

- `Vaults`
- `Earn yield without revealing your position. Every deposit is shielded onchain.`

Vault card data:

- Name: `Steakhouse Confidential Prime USDC`
- Curator: `Steakhouse Financial`
- Token: `cUSDC`
- Fields: `APY`, `Total deposits`, `Collateral`
- CTA: `View`

Suggestion block:

- `Suggest the next confidential vault`
- `Which vault would you like to access confidentially?`
- `Suggest a vault`

Ý nghĩa cho app mình:

- Có thể dùng card pattern cho official registry pairs: name, symbol, status metrics, CTA.
- Có thể thêm “suggest/add pair” UX để phục vụ extensibility/local config.

## Vault detail

URL:

`https://app.zama.org/earn/ethereum/0xbEEF00A59B577423653A1526c7009bdE103F542B/steakhouse-confidential-prime-usdc`

Route data:

- Chain segment: `ethereum`
- Vault address segment: `0xbEEF00A59B577423653A1526c7009bdE103F542B`
- Slug: `steakhouse-confidential-prime-usdc`

Heading/copy:

- `Deposit`
- `Deposit assets into this vault to start earning yield.`
- `Steakhouse Confidential Prime USDC`
- `Deposit`
- `Withdraw`
- `Amount`
- `cUSDC`
- `Connect your wallet to see your balance`
- `Confidential deposit.`
- `Connect wallet`

Description:

`Steakhouse Confidential Prime USDC vault aims to optimize yield by lending USDC against blue chip collaterals. Users can deposit Confidential USDC (cUSDC) in batches via the Zama app at app.zama.org.`

Detail fields:

- `Total deposits — USDC`
- `Performance fee`
- `Curator Steakhouse Financial`
- `More details`

Ý nghĩa cho app mình:

- Nếu thêm trang detail cho pair, route nên có network/address/slug rõ ràng.
- Pair detail có thể có tabs/actions tương tự: wrap, unwrap, decrypt, faucet.
- Copy nên ngắn, trực tiếp, mô tả hành động hiện tại.

## Design/UX takeaways

- Sidebar app shell là pattern chính.
- Các action đều nằm trong card/form trung tâm, không dùng landing page.
- Copy dùng cặp động từ rõ: Shield, Unshield, Send, Earn.
- Trạng thái pre-wallet nhất quán: `Connect wallet` và `Connect your wallet to see your balance`.
- Token actions nên có selector, balance area, output preview, và CTA bị khóa nếu chưa connect wallet.
- App dùng dark/black visual shell với Zama-style branding; giữ yellow accent cho app mình theo yêu cầu trước đó.

## Khác biệt cần giữ cho challenge

App mình không chỉ clone Zama App. Challenge yêu cầu thêm:

- Browse official Sepolia Wrappers Registry.
- Faucet cho official cTokenMock underlying tokens.
- Decrypt balance của bất kỳ ERC-7984 token nào.
- Local config cho custom/dev-only pairs.
- Add token 3 loại: ERC20, CToken thường, CToken xịn.
- Create token 2 loại: ERC20, CToken xịn.
- Cache byte32 balance handle để tránh lặp decrypt setup mỗi lần vào app.
