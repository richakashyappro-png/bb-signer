# BountyBook Signer

Static, single-page signer for BountyBook nonce authentication.

## Security contract
- Exactly two wallet RPCs: `eth_requestAccounts` (connect) and one `personal_sign`
- No transactions, approvals, transfers, chain switching, asset requests
- No seed phrase / private key handling of any kind
- The signature is displayed on-page for manual copy; nothing is ever uploaded

## Audit
- RPC methods: eth_requestAccounts, eth_accounts (read-only), personal_sign
- External loads: @coinbase/wallet-sdk v4.3.7 via esm.sh only
