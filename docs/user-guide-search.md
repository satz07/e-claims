# Search & list claims

This guide covers **finding and reviewing claims** in E-claims: the **Claims** home page (all claims list) and the **Search Claim** page in the sidebar.

---

## Claims — view all claims (home)

When you open the portal, the default page is **Claims** (sidebar: **Claims**).

### What you see

- **All Claims** — title and filters at the top.  
- **All Results** — table of claims with columns:

| Column | Meaning |
|--------|---------|
| **Claim #** | Numeric claim number. |
| **SHA** | Short SHA code assigned at issue time. |
| **Provider** | Provider name (if stored for display). |
| **Patient** | Patient name (if stored for display). |
| **Created** | Creation date shown for the claim. |
| **Total** | Claimed amount. |
| **Status** | Current status (e.g. unknown, approved, rejected). |

The list loads automatically when you open the page. Use **pagination** at the bottom if there are many claims.

### Filter on the Claims page

Under **Select Search Type** you can choose:

| Search type | How to use it |
|-------------|----------------|
| **Status** | Pick a status from the second dropdown (Unknown, Approved, Rejected, etc.). The list reloads. |
| **Claim Type** | Pick a claim type (e.g. Surgical Claim, Maternity Claim). The list reloads. |
| **Claim Number** | Enter the numeric claim number and click **Search**. Shows that single claim if it exists. |

**Tip:** For a claim you just issued, use **Claim Number** with the number from the success screen, or use **Search Claim** (below) with the full **Claim ID**.

### Status labels you may see

| Status shown | Typical meaning |
|--------------|-----------------|
| **unknown** | Newly submitted; not yet updated to a final state. |
| **approved** | Approved in the registry workflow. |
| **rejected** | Rejected. |
| **declined** | Declined. |
| **sent-back** | Sent back for correction or more information. |
| **sent-for-payment-processing** | Moving toward payment. |
| **medical-review** | Under medical review. |

Exact labels come from the on-chain status and how the portal maps them.

---

## Search Claim — find one claim

In the sidebar, click **Search Claim** (search icon). The page title is **Claim Services**.

### Tab: Search Claim

1. Enter the **Claim ID** (the full UUID from when the claim was issued — recommended).  
2. Click **Search** (or press Enter).  
3. If found, a detail card shows:

   - Claim Number  
   - Claim ID  
   - Claim Type  
   - Patient Name  
   - Provider Name  
   - SHA Code  
   - Claimed Total  
   - Approved Total  
   - Status  
   - Date From / Date To  

If you see **“Claim not found”** or an error:

- Check you copied the **full Claim ID** with no extra spaces.  
- You can try the numeric **Claim Number** only if your environment supports it.  
- The claim may have been issued on a different deployment (demo vs production).  

### Tab: Record Check (duplicate check)

Use this when your process needs to know if a **Claim ID was already registered**:

1. Switch to the **Record Check** tab.  
2. Enter the **Claim ID** to check.  
3. Click **Record Check**.  
4. Result:
   - **No (available)** — no matching registration found for that ID on the chain (for this environment).  
   - **Yes (duplicate)** — a claim with that ID fingerprint already exists.  

This supports anti–double-submission checks; it does not replace your full fraud or eligibility rules.

---

## Which search should I use?

| Goal | Where to go |
|------|-------------|
| Browse recent claims | **Claims** (home) |
| Open one claim by number | **Claims** → Search type **Claim Number** |
| Open one claim by UUID | **Search Claim** → **Search Claim** tab |
| Check if ID already used | **Search Claim** → **Record Check** tab |
| Filter by status or type (list view) | **Claims** → Status or Claim Type |

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| **Empty list** | No claims issued yet on this environment; or API/network issue — contact administrator. |
| **“No data found”** | Same as above; try refreshing the page. |
| **Search returns not found** | Wrong Claim ID; wrong environment; claim not yet indexed — wait and retry. |
| **Names show “—”** | Display metadata may not have been saved after issue; on-chain data may still exist. |
| **Status always unknown** | Normal for new claims until status is updated by an authorised process. |

---

## Related guides

- [Issue a claim](./user-guide-issue-claim.md) — how to submit a new claim  
- [Demo runbook](./demo-runbook.md) — setup for trials and demos  
