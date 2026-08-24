// ==UserScript==
// @name         ECW Auto-link Claim(Farhan)
// @namespace    http://tampermonkey.net/
// @version      2.3.1
// @description  Auto-link CPTs with ICDs on the ECW CLAIM TAB (icdTable / cptTable)
// @match https://*.ecwcloud.com/mobiledoc/jsp/webemr/*
// @match https://*.ecwcloud.com/mobiledoc/jsp/webemr/index.jsp*
// @match https://*.eclinicalweb.com/mobiledoc/jsp/webemr/*
// @match https://*.ecwcloud.com/mobiledoc/jsp/webemr/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/FarhanKaB/ECW_Claim_Linking/main/Claim_Link.user.js
// @downloadURL  https://raw.githubusercontent.com/FarhanKaB/ECW_Claim_Linking/main/Claim_Link.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ─── UI notification (same as billing-tab version) ────────────────
    const NOTIFICATION_GAP = 12;
    const activeNotifications = [];

    if (!document.getElementById('ecw-notify-style')) {
        const style = document.createElement('style');
        style.id = 'ecw-notify-style';
        style.textContent = `
            @keyframes ecwNotifySlideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes ecwNotifySlideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }

    function repositionNotifications() {
        let top = 80;
        activeNotifications.forEach(container => {
            if (!document.body.contains(container)) return;
            container.style.top = top + 'px';
            top += container.offsetHeight + NOTIFICATION_GAP;
        });
    }

    function dismissNotification(container) {
        container.style.animation = 'ecwNotifySlideOut 0.25s ease forwards';
        setTimeout(() => {
            container.remove();
            const idx = activeNotifications.indexOf(container);
            if (idx !== -1) activeNotifications.splice(idx, 1);
            repositionNotifications();
        }, 250);
    }

    function showNotification(messages, colorType = 'red') {
        if (typeof messages === 'string') messages = [messages];
        if (!messages.length) return;
        const key = messages.join('||');
        if (activeNotifications.some(c => c.dataset.msgKey === key)) return;

        const COLOR_MAP = {
            yellow: { accent: '#b45309', bg: '#f59e0b', border: '#d97706', text: '#ffffff', icon: '!' },
            red:    { accent: '#7f1d1d', bg: '#dc2626', border: '#b91c1c', text: '#ffffff', icon: '!' },
            blue:   { accent: '#1e3a8a', bg: '#3b82f6', border: '#2563eb', text: '#ffffff', icon: 'i' }
        };
        const c = COLOR_MAP[colorType] || COLOR_MAP.red;

        const container = document.createElement('div');
        container.dataset.msgKey = key;
        Object.assign(container.style, {
            position: 'fixed', top: '80px', right: '20px', display: 'flex', alignItems: 'flex-start',
            gap: '12px', width: '360px', maxWidth: '90vw', padding: '14px 16px',
            background: c.bg, backdropFilter: 'blur(8px)',
            border: '1px solid ' + c.border, borderLeft: '4px solid ' + c.accent, borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)', zIndex: '9999999',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: '13.5px', color: c.text, animation: 'ecwNotifySlideIn 0.3s ease', transition: 'top 0.25s ease'
        });

        const iconBadge = document.createElement('div');
        Object.assign(iconBadge.style, {
            flexShrink: '0', width: '22px', height: '22px', borderRadius: '50%', background: '#ffffff',
            color: c.bg, fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginTop: '1px'
        });
        iconBadge.textContent = c.icon;
        container.appendChild(iconBadge);

        const content = document.createElement('div');
        content.style.flex = '1';
        content.style.minWidth = '0';

        if (messages.length === 1) {
            const p = document.createElement('div');
            p.style.lineHeight = '1.4';
            p.style.fontWeight = '500';
            p.textContent = messages[0];
            content.appendChild(p);
        } else {
            const list = document.createElement('ul');
            list.style.margin = '0';
            list.style.paddingLeft = '18px';
            list.style.lineHeight = '1.5';
            messages.forEach(msg => {
                const li = document.createElement('li');
                li.textContent = msg;
                list.appendChild(li);
            });
            content.appendChild(list);
        }
        container.appendChild(content);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '\u00d7';
        Object.assign(closeBtn.style, {
            flexShrink: '0', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.8)',
            fontSize: '18px', lineHeight: '1', cursor: 'pointer', padding: '0', marginLeft: '4px'
        });
        closeBtn.onmouseenter = () => closeBtn.style.color = '#ffffff';
        closeBtn.onmouseleave = () => closeBtn.style.color = 'rgba(255,255,255,0.8)';
        closeBtn.onclick = () => dismissNotification(container);
        container.appendChild(closeBtn);

        document.body.appendChild(container);
        activeNotifications.push(container);
        repositionNotifications();
        setTimeout(() => dismissNotification(container), 5000);
    }

    // ─── Claim-tab specific selectors ─────────────────────────────────
    // ICD table lives inside #icdTable, real rows carry ng-repeat="icd in ICDCodes..."
    // CPT table lives inside #cptTable, real rows carry ng-repeat="cpt in CPTCodes..."

    function getICDRows() {
        return Array.from(document.querySelectorAll('#icdTable tbody tr[ng-repeat]'));
    }

    function getCPTRows() {
        return Array.from(document.querySelectorAll('#cptTable tbody tr[ng-repeat]'));
    }

    function getICDRowNumber(row) {
        return row.querySelector('td:nth-child(1)')?.textContent.trim();
    }

    function getICDCode(row) {
        const input = row.querySelector('input[data-fieldname="ClaimICDCode"]');
        return input ? input.value.trim().toUpperCase() : '';
    }

    function getCPTRowNumber(row) {
        return row.querySelector('td:nth-child(1) span')?.textContent.trim();
    }

    function getCPTCode(row) {
        const input = row.querySelector('input[data-fieldname="claimCPTCode"]');
        return input ? input.value.trim() : '';
    }

    function getCPTICDInput(row, slot) {
        return row.querySelector(`input[data-fieldname="ClaimCPTICD${slot}"]`);
    }

    function getCPTMod1Input(row) {
        return row.querySelector('input[data-fieldname="ClaimCPTMOD1"]');
    }

    function getCPTPOSInput(row) {
        return row.querySelector('input[data-fieldname="ClaimCPTPOS"]');
    }

    function getCPTTOSInput(row) {
        return row.querySelector('input[data-fieldname="ClaimCPTTOS"]');
    }

    function getCPTBilledFeeInput(row) {
        return row.querySelector('input[data-fieldname="ClaimCPTBilledFee"]');
    }

    // "Assign To Patient" checkbox in column 2 — treated as the row's selected state.
    function isCPTRowSelected(row) {
        const chk = row.querySelector('td:nth-child(2) input[type="checkbox"]');
        return !!chk && chk.checked;
    }

    function getClaimLevelPOSInput() {
        return document.querySelector('input[data-fieldname="ClaimPOS"]');
    }

    // Insurance table: tr[ng-repeat="insurance in Insurances..."], primary row's
    // sequence span carries class "lblue-notification" (label "P").
    function getPrimaryInsuranceName() {
        const rows = Array.from(document.querySelectorAll('#billingClaimTbl5 tbody tr[ng-repeat]'));
        const primaryRow = rows.find(row => {
            const seqSpan = row.querySelector('td:nth-child(1) span');
            return seqSpan && seqSpan.classList.contains('lblue-notification');
        });
        if (!primaryRow) return null;
        const nameTd = primaryRow.querySelector('td:nth-child(2)');
        return nameTd ? (nameTd.getAttribute('title') || nameTd.textContent).trim() : null;
    }

    // ─── Helpers ────────────────────────────────────────────────────────
    function setInputValue(inputEl, value) {
        if (!inputEl) return;
        inputEl.focus();
        inputEl.value = value;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        inputEl.blur();
    }

    function getServiceDate() {
        const input = document.querySelector('input[data-fieldname="ClaimServiceDate"]');
        if (!input) return null;
        const raw = (input.value || input.title || '').trim(); // MM/DD/YYYY
        const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) return null;
        const [, mm, dd, yyyy] = match;
        const date = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
        return isNaN(date) ? null : date;
    }

    function getPatientAge() {
        const span = document.querySelector(".patient-identifier-span");
        if (!span) return null;
        const text = span.textContent;
        const dobMatch = text.match(/(\w+ \d{1,2},\s*\d{4})/);
        if (!dobMatch) return null;
        const dob = new Date(dobMatch[1]);
        if (isNaN(dob)) return null;

        let serviceDate = getServiceDate();
        if (!serviceDate) serviceDate = new Date();

        let age = serviceDate.getFullYear() - dob.getFullYear();
        const monthDiff = serviceDate.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && serviceDate.getDate() < dob.getDate())) age--;
        return age;
    }

    // ─── Preventive age rules ──────────────────────────────────────────
    const PREVENTIVE_RULES = {
        "99391": { min: 0, max: 0 }, "99392": { min: 1, max: 4 }, "99393": { min: 5, max: 11 },
        "99394": { min: 12, max: 17 }, "99395": { min: 18, max: 39 }, "99396": { min: 40, max: 64 },
        "99397": { min: 65, max: 999 }, "99381": { min: 0, max: 0 }, "99382": { min: 1, max: 4 },
        "99383": { min: 5, max: 11 }, "99384": { min: 12, max: 17 }, "99385": { min: 18, max: 39 },
        "99386": { min: 40, max: 64 }, "99387": { min: 65, max: 999 }
    };

    // ─── Eye-related ICD detection ──────────────────────────────────────
    // Covers all non-Z eye/adnexa codes across chapters, not just H00-H59:
    //   H00-H59  Diseases of the eye and adnexa (minus unused H07-H09/H41)
    //   C69      Malignant neoplasm of eye and adnexa
    //   D31      Benign neoplasm of eye and adnexa
    //   Q10-Q15  Congenital malformations of eye
    //   S05      Injury of eye and orbit
    //   T15      Foreign body on external eye
    //   T26      Burn and corrosion confined to eye and adnexa
    //   P39.1    Neonatal conjunctivitis and dacryocystitis
    const EYE_ICD_PATTERNS = [
        /^H(0[0-6]|1[0-9]|2[0-8]|3[0-6]|40|4[2-9]|5[0-9])/,
        /^C69/,
        /^D31/,
        /^Q1[0-5]/,
        /^S05/,
        /^T15/,
        /^T26/,
        /^P39\.1/
    ];

    function isEyeICD(code) {
        return !!code && EYE_ICD_PATTERNS.some(p => p.test(code));
    }

    // ─── Pain-related ICD detection ─────────────────────────────────────
    // Explicit whitelist of pain-related codes spanning multiple ICD-10
    // chapters (R-codes, G-codes, M-codes, K-codes, T-codes), plus a
    // default-on rule for the M chapter (musculoskeletal) since most of it
    // is pain-related, carved down by an explicit exclude list.
    const PAIN_RELATED_ICD_CODES = new Set([
        "R52", "R52.0", "R52.1", "R52.2", "R52.9", "R51",
        "G44.1", "G44.209", "G44.401", "G44.501",
        "R07.0", "R07.1", "R07.2", "R07.9",
        "M54.2", "M54.5", "M54.4", "M54.8", "M54.9", "M54.59", "M54.50", "M54.12",
        "M25.5", "M25.51", "M25.52", "M25.53", "M25.54", "M25.55", "M25.56", "M25.57", "M25.58", "M25.59",
        "M25.511", "M25.512", "M25.519", "M25.521", "M25.522", "M25.529", "M25.531", "M25.532", "M25.539", "M25.541", "M25.542", "M25.549",
        "M25.551", "M25.552", "M25.559", "M25.561", "M25.562", "M25.569", "M25.571", "M25.572", "M25.579",
        "M79.6", "M79.1", "M79.2", "M79.7",
        "G89.0", "G89.2", "G89.3", "G89.4", "G89.21", "G89.22", "G89.29",
        "G50.1", "G56.0", "G57.0",
        "R10.0", "R10.2", "R10.30", "R10.4", "M17.0",
        "N94.4", "N94.5", "N94.6", "M72.2",
        "R52.81", "R52.82", "R52.89", "M54.16", "M10.9", "M17.12", "M79.10","M85.80","R25.2","M43.16","K59.4",
        "T14.0", "T79.8XXA",
        "K52.9",
        "R11.2"
    ]);
    // M-codes are treated as pain-related BY DEFAULT, except this specific
    // exclude list — structural deformities, stiffness/contracture/
    // ankylosis, asymptomatic bone-density findings, and instability-not-
    // pain joint findings. Everything else under M is pain-related unless
    // listed here.
    const NON_PAIN_M_EXACT_CODES = new Set([
        "M67.4", "M72.0", "M79.3",
        "M81.0", "M81.6", "M81.8",
        "M22.0", "M22.1", "M24.4", "M24.5", "M24.6", "M25.6", "M62.4", "M62.81", "M89.7"
    ]);
    const NON_PAIN_M_PREFIXES = [
        "M20.", "M21.", "M40.", "M41.", "M43.0", "M43.1", "M85.", "M95.", "M96.", "M88"
    ];

    function isPainRelatedICD(code) {
        if (!code) return false;
        if (PAIN_RELATED_ICD_CODES.has(code)) return true;
        if (code.startsWith('M')) {
            if (NON_PAIN_M_EXACT_CODES.has(code)) return false;
            if (NON_PAIN_M_PREFIXES.some(prefix => code.startsWith(prefix))) return false;
            return true;
        }
        return false;
    }

    // ─── CPT Rules (full parity with billing-tab script) ────────────────
    function buildCPTRules() {
        const rules = {};
        const prevICDs = ["Z00.01", "Z00.121", "Z00.00", "Z00.129", "Z68", "Z71.3", "Z71.82", "Z71.89"];
        const prevCodes = [
            "99391","99392","99393","99394","99395","99396","99397",
            "99381","99382","99383","99384","99385","99386","99387",
            "G0438","G0439","G0402"
        ];
        prevCodes.forEach(c => { rules[c] = { type: "customICDCollector", icdList: prevICDs }; });

        const ecgICDs = ["E78","I10","R00.0","R00.1","R00.2","R03.0","R06.02","R07.9","Z13.6"];
        const labDrawICDs = ["E08","E09","E10","E11","E13","R73.03","E78","E00","E01","E02","E03","I10"];
        const b12ICDs = ["D51.9","E53.9"];

        Object.assign(rules, {
            "3008F": { type: "customICDCollector", icdList: ["Z00.01","Z00.121","Z00.00","Z00.129","E66.3","E66.9","E66.01","E66.09","R63.6","Z68"] },
            "2010F": { type: "bmiLink" },
            "0503F": { type: "exact", icds: ["Z39.2"], fallback: "officeVisit" },
            "99401": { type: "multiICD", icds: [["Z71.3"], ["Z71.82","Z71.89"]] },
            "99402": { type: "multiICD", icds: [["Z71.3"], ["Z71.82","Z71.89"]] },
            "99406": { type: "multiICD", icds: [["F17"], ["Z71.6"]] },
            "G0447": { type: "multiICD", icds: [["E66.9","E66.01","E66.09"], ["Z68"]] },
            // G8418 / G8417 / G8420 / 2010F are handled by the dedicated
            // 3008F-style branch in linkCPTGeneric (first non-Z ICD row ->
            // slot 1, Z68 BMI row -> slot 2), NOT as customICDCollector or
            // startsWith rules. Registered here with a harmless placeholder
            // type only so they show up in cptRules (needed for
            // handleUnlistedCPTs to not flag them).
            "G8418": { type: "bmiLink" },
            "G8417": { type: "bmiLink" },
            "G8420": { type: "bmiLink" },
            "LSM01": { type: "customICDCollector", icdList: ["Z71.3","Z71.82","Z71.89"], fallback: "officeVisit" },
            "PD001": { type: "customICDCollector", icdList: ["Z71.3","Z71.82","Z71.89"], fallback: "officeVisit" },
            "4013F": { type: "startsWith", icds: ["E78"], fallback: "officeVisit" },
            "2026F": { type: "startsWith", icds: ["E11"], fallback: "officeVisit" },
            "2033F": { type: "startsWith", icds: ["E11"], fallback: "officeVisit" },
            "3072F": { type: "startsWith", icds: ["E11"], fallback: "officeVisit" },
            "4010F": { type: "startsWith", icds: ["I10"], fallback: "officeVisit" },
            "CP001": { type: "exact", icds: ["Z09","Z71.89","Z76.89"], fallback: "officeVisit" },
            "3074F": { type: "startsWith", icds: ["I10"], fallback: "officeVisit" },
            "3075F": { type: "startsWith", icds: ["I10"], fallback: "officeVisit" },
            "3077F": { type: "startsWith", icds: ["I10"], fallback: "officeVisit" },
            "3078F": { type: "startsWith", icds: ["I10"], fallback: "officeVisit" },
            "3079F": { type: "startsWith", icds: ["I10"], fallback: "officeVisit" },
            "3080F": { type: "startsWith", icds: ["I10"], fallback: "officeVisit" },
            "G8752": { type: "startsWith", icds: ["I10"], fallback: "officeVisit" },
            "G8753": { type: "startsWith", icds: ["I10"], fallback: "officeVisit" },
            "G8754": { type: "startsWith", icds: ["I10"], fallback: "officeVisit" },
            "G8755": { type: "startsWith", icds: ["I10"], fallback: "officeVisit" },
            "3725F": { type: "exact", icds: ["Z13.31"], fallback: "officeVisit" },
            "G8510": { type: "exact", icds: ["Z13.31"], fallback: "officeVisit" },
            "G0444": { type: "exact", icds: ["Z13.31"], fallback: "officeVisit" },
            "G8431": { type: "exact", icds: ["Z13.31"], fallback: "officeVisit" },
            "1000F": { type: "startsWith", icds: ["F17"], fallback: "officeVisit" },
            "1036F": { type: "startsWith", icds: ["F17"], fallback: "officeVisit" },
            "G9275": { type: "startsWith", icds: ["F17"], fallback: "officeVisit" },
            "G9276": { type: "startsWith", icds: ["F17"], fallback: "officeVisit" },
            "G9622": { type: "exact", icds: ["Z13.89","Z13.9"], fallback: "officeVisit" },
            "G0442": { type: "exact", icds: ["Z13.89","Z13.9"], fallback: "officeVisit" },
            "3016F": { type: "exact", icds: ["Z13.89","Z13.9"], fallback: "officeVisit" },
            "H0049": { type: "exact", icds: ["Z13.89","Z13.9"], fallback: "officeVisit" },
            "G0136": { type: "officeVisit" },
            "1100F": { type: "officeVisit" },
            "3288F": { type: "officeVisit" },
            "1101F": { type: "officeVisit" },
            // 1125F is handled by the dedicated pain-related-ICD branch in
            // linkCPTGeneric (isPainRelatedICD), NOT as a plain startsWith:"M"
            // rule — see PAIN_RELATED_ICD_CODES / NON_PAIN_M_* above.
            "1125F": { type: "painLink", fallback: "officeVisit" },
            // 99497 (Advance Care Planning) is handled by a dedicated
            // chronic-disease-ICD branch in linkCPTGeneric, using the same
            // CHRONIC_CODES set defined below (near the 99214 check) —
            // NOT a customICDCollector rule here, since CHRONIC_CODES isn't
            // declared yet at the point buildCPTRules() runs.
            "99497": { type: "chronicLink", fallback: "officeVisit" },
            "1126F": { type: "officeVisit" },
            "1157F": { type: "officeVisit" },
            "1160F": { type: "officeVisit" },
            "1170F": { type: "officeVisit" },
            "3048F": { type: "startsWith", icds: ["E78","Z71.2"], fallback: "officeVisit" },
            "3049F": { type: "startsWith", icds: ["E78","Z71.2"], fallback: "officeVisit" },
            "3050F": { type: "startsWith", icds: ["E78","Z71.2"], fallback: "officeVisit" },
            "3044F": { type: "startsWith", icds: ["E11","R73.03","Z71.2"], fallback: "officeVisit" },
            "3051F": { type: "startsWith", icds: ["E11","R73.03","Z71.2"], fallback: "officeVisit" },
            "3052F": { type: "startsWith", icds: ["E11","R73.03","Z71.2"], fallback: "officeVisit" },
            "3046F": { type: "startsWith", icds: ["E11","R73.03","Z71.2"], fallback: "officeVisit" },
            "3060F": { type: "exact", icds: ["Z71.2"], fallback: "officeVisit" },
            "3061F": { type: "exact", icds: ["Z71.2"], fallback: "officeVisit" },
            "Q0091": { type: "exact", icds: ["Z12.4"], fallback: "officeVisit" },
            "G0101": { type: "exact", icds: ["Z12.4"], fallback: "officeVisit" },
            "88150": { type: "exact", icds: ["Z12.4"], fallback: "officeVisit" },
            "88142": { type: "exact", icds: ["Z12.4"], fallback: "officeVisit" },
            "86480": { type: "exact", icds: ["Z11.1"], fallback: "officeVisit" },
            "S0612": { type: "multiICD", icds: [["Z11.51","Z12.4"]], fallback: "officeVisit" },
            "90460": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90461": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90471": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90472": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "G0008": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "G0009": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90674": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90686": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90688": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90715": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90746": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90589": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90700": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90702": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90696": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90697": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90723": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90698": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90633": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90740": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90743": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90744": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90747": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90647": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90648": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90651": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90707": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90710": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90619": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90620": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90621": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90624": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90734": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90623": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90732": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90671": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90677": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90713": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90680": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90681": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90714": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90622": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90611": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90716": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90749": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90656": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90657": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90658": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90660": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90661": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "91319": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "91320": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "91321": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "91322": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "91323": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "91304": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90480": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90380": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90381": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "90382": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "96380": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "96381": { type: "exact", icds: ["Z23"], fallback: "officeVisit" },
            "93000": { type: "customICDCollector", icdList: ecgICDs, fallback: "officeVisit", useRowOrder: true },
            "93005": { type: "customICDCollector", icdList: ecgICDs, fallback: "officeVisit", useRowOrder: true },
            "93010": { type: "customICDCollector", icdList: ecgICDs, fallback: "officeVisit", useRowOrder: true },
            "81025": { type: "exact", icds: ["Z32.00","Z32.01","Z32.02"], fallback: "officeVisit" },
            "83014": { type: "exact", icds: ["B96.81"], fallback: "officeVisit" },
            "86580": { type: "exact", icds: ["Z11.1"], fallback: "officeVisit" },
            "87811": { type: "exact", icds: ["Z11.52"], fallback: "officeVisit" },
            "92228": { type: "startsWith", icds: ["E11"], fallback: "officeVisit" },
            "92250": { type: "startsWith", icds: ["E11"], fallback: "officeVisit" },
            "82962": { type: "startsWith", icds: ["E11"], fallback: "officeVisit" },
            "94060": { type: "exact", icds: ["R06.2"], fallback: "officeVisit" },
            "96160": { type: "exact", icds: ["Z71.89"], fallback: "officeVisit" },
            "G9820": { type: "exact", icds: ["Z11.3"], fallback: "officeVisit" },
            "96372": { type: "customICDCollector", icdList: b12ICDs, fallback: "officeVisit" },
            "97802": { type: "customICDCollector", icdList: ["Y93.79","Y93.81"], fallback: "officeVisit" },
            "J3420": { type: "customICDCollector", icdList: b12ICDs, fallback: "officeVisit" },
            "99408": { type: "exact", icds: ["Z13.9"], fallback: "officeVisit" },
            "99173": { type: "exact", icds: ["Z01.00","Z00.01","Z00.121"], fallback: "officeVisit" },
            "82270": { type: "exact", icds: ["Z12.11"], fallback: "officeVisit" },
            "G0108": { type: "startsWith", icds: ["E11"], fallback: "officeVisit" },
            "2028F": { type: "startsWith", icds: ["E11"], fallback: "officeVisit" },
            "2023F": { type: "startsWith", icds: ["E11"], fallback: "officeVisit" },
            "4008F": { type: "startsWith", icds: ["I10"], fallback: "officeVisit" },
            "69209": { type: "startsWith", icds: ["H61"], fallback: "officeVisit" },
            "96210": { type: "startsWith", icds: ["H61"], fallback: "officeVisit" },
            "G0445": { type: "exact", icds: ["Z11.3"], fallback: "officeVisit" },
            "G0328": { type: "exact", icds: ["Z12.11"], fallback: "officeVisit" },
            "G0123": { type: "exact", icds: ["Z12.4"], fallback: "officeVisit" },
            "G2023": { type: "exact", icds: ["Z11.52"], fallback: "officeVisit" },
            "87110": { type: "exact", icds: ["Z11.8"], fallback: "officeVisit" },
            "82950": { type: "exact", icds: ["Z13.1"], fallback: "officeVisit" },
            "95251": { type: "exact", icds: ["E11.9"], fallback: "officeVisit" },
            "95249": { type: "exact", icds: ["Z46.89"], fallback: "officeVisit" },
            "3014F": { type: "exact", icds: ["Z71.2"], fallback: "officeVisit" },
            "3015F": { type: "exact", icds: ["Z12.4","Z71.2"], fallback: "officeVisit" },
            "3017F": { type: "multiICD", icds: [["Z12.11","Z71.2"]], fallback: "officeVisit" },
            "99211": { type: "officeVisit" },
            "99212": { type: "officeVisit" },
            "99213": { type: "officeVisit" },
            "99214": { type: "officeVisit" },
            "99215": { type: "officeVisit" },
            "99201": { type: "officeVisit" },
            "99202": { type: "officeVisit" },
            "99203": { type: "officeVisit" },
            "99204": { type: "officeVisit" },
            "99205": { type: "officeVisit" },
            "36415": { type: "labDrawThenZ13", icdList: labDrawICDs },
            "1111F": { type: "officeVisit" },
            "99051": { type: "officeVisit" },
            "82274": { type: "officeVisit" },
            "99000": { type: "officeVisit" }
        });
        return rules;
    }

    const cptRules = buildCPTRules();

    // ─── Core linking functions ─────────────────────────────────────────
    function officeVisit(cptCodes, icdRows, cptRows) {
        const topICDs = [];
        for (const row of icdRows) {
            const val = getICDCode(row);
            if (!val) continue;
            if (val.startsWith('Z')) continue; // skip this Z row, keep scanning further rows
            const firstChar = val[0];
            if (firstChar >= 'A' && firstChar <= 'Y') {
                const rowNum = getICDRowNumber(row);
                if (rowNum) topICDs.push(rowNum);
                if (topICDs.length === 4) break;
            }
        }
        if (!topICDs.length) return;

        cptCodes.forEach(code => {
            const matches = cptRows.filter(row => getCPTCode(row) === code);
            matches.forEach(row => {
                for (let i = 1; i <= 4; i++) setInputValue(getCPTICDInput(row, i), '');
                topICDs.forEach((num, idx) => setInputValue(getCPTICDInput(row, idx + 1), num));
            });
        });
    }

    function matchICDsFromList(icdList, availableICDs) {
        const matched = [];
        icdList.forEach(code => {
            if (code.includes('.')) {
                const exact = availableICDs.find(i => i === code.toUpperCase());
                if (exact) matched.push(exact);
            } else {
                availableICDs.forEach(i => { if (i.startsWith(code.toUpperCase())) matched.push(i); });
            }
        });
        return [...new Set(matched)];
    }

    function linkCPTGeneric(icdRows, cptRows) {
        const allICDs = icdRows.map(getICDCode).filter(Boolean);

        for (const [cpt, rule] of Object.entries(cptRules)) {
            const matches = cptRows.filter(row => getCPTCode(row) === cpt);
            matches.forEach(row => {
                for (let i = 1; i <= 4; i++) setInputValue(getCPTICDInput(row, i), '');

                if (rule.type === "officeVisit") {
                    officeVisit([cpt], icdRows, cptRows);
                    return;
                }

                if (rule.type === "labDrawThenZ13") {
                    // Try the priority chronic/metabolic ICD list first
                    // (diabetes, prediabetes, hyperlipidemia, thyroid,
                    // hypertension), in claim-grid order, up to 4 slots.
                    const matchedRows = icdRows.filter(r => {
                        const val = getICDCode(r);
                        if (!val) return false;
                        return rule.icdList.some(code =>
                            code.includes('.') ? val === code.toUpperCase() : val.startsWith(code.toUpperCase())
                        );
                    });
                    if (matchedRows.length) {
                        matchedRows.slice(0, 4).forEach((r, idx) => {
                            const rowNum = getICDRowNumber(r);
                            if (rowNum) setInputValue(getCPTICDInput(row, idx + 1), rowNum);
                        });
                        return;
                    }
                    // No priority-list match — fall back to the original
                    // 36415 behavior: office-visit link if any non-Z
                    // diagnosis exists, else link to Z13.0 (lab screening).
                    const hasNonZ = icdRows.some(r => {
                        const val = getICDCode(r);
                        return val && !val.startsWith('Z');
                    });
                    if (hasNonZ) {
                        officeVisit([cpt], icdRows, cptRows);
                    } else {
                        const z13Row = icdRows.find(r => getICDCode(r) === 'Z13.0');
                        if (z13Row) {
                            const rowNum = getICDRowNumber(z13Row);
                            if (rowNum) setInputValue(getCPTICDInput(row, 1), rowNum);
                        }
                    }
                    return;
                }

                if (cpt === "3008F" || cpt === "G8420" || cpt === "G8418" || cpt === "G8417" || cpt === "2010F") {
                    let slot = 1;
                    const priorityICDs = ["Z00.01","Z00.121","Z00.00","Z00.129","E66.3","E66.9","E66.01","E66.09","R63.6"];
                    let firstRowNum = null;
                    for (const code of priorityICDs) {
                        const found = icdRows.find(r => getICDCode(r) === code);
                        if (found) { firstRowNum = getICDRowNumber(found); break; }
                    }
                    if (!firstRowNum) {
                        for (const r of icdRows) {
                            const val = getICDCode(r);
                            if (val && !val.startsWith('Z')) { firstRowNum = getICDRowNumber(r); break; }
                        }
                    }
                    if (firstRowNum) { setInputValue(getCPTICDInput(row, 1), firstRowNum); slot = 2; }
                    const z68Row = icdRows.find(r => getICDCode(r).startsWith('Z68'));
                    if (z68Row && slot <= 4) {
                        const z68Num = getICDRowNumber(z68Row);
                        if (z68Num) setInputValue(getCPTICDInput(row, slot), z68Num);
                    }
                    return;
                }

                if (cpt === "1125F") {
                    // Link to pain-related ICD rows (in claim ICD-grid order),
                    // filling up to 4 slots.
                    const painRows = icdRows.filter(r => isPainRelatedICD(getICDCode(r)));
                    if (painRows.length) {
                        painRows.slice(0, 4).forEach((r, idx) => {
                            const rowNum = getICDRowNumber(r);
                            if (rowNum) setInputValue(getCPTICDInput(row, idx + 1), rowNum);
                        });
                        return;
                    }
                    // No pain-related ICD found — fall back to standard
                    // office-visit linking.
                    officeVisit([cpt], icdRows, cptRows);
                    return;
                }

                if (cpt === "99497") {
                    // Link to chronic-disease ICD rows (in claim ICD-grid
                    // order), filling up to 4 slots. Uses the same
                    // CHRONIC_CODES set as the 99214 eligibility check.
                    const chronicRows = icdRows.filter(r => CHRONIC_CODES.has(getICDCode(r)));
                    if (chronicRows.length) {
                        chronicRows.slice(0, 4).forEach((r, idx) => {
                            const rowNum = getICDRowNumber(r);
                            if (rowNum) setInputValue(getCPTICDInput(row, idx + 1), rowNum);
                        });
                        return;
                    }
                    // No chronic-disease ICD found — fall back to standard
                    // office-visit linking.
                    officeVisit([cpt], icdRows, cptRows);
                    return;
                }

                if (cpt === "99173") {
                    // Try eye-related ICD rows first (in claim ICD-grid order),
                    // filling up to 4 slots.
                    const eyeRows = icdRows.filter(r => isEyeICD(getICDCode(r)));
                    if (eyeRows.length) {
                        eyeRows.slice(0, 4).forEach((r, idx) => {
                            const rowNum = getICDRowNumber(r);
                            if (rowNum) setInputValue(getCPTICDInput(row, idx + 1), rowNum);
                        });
                        return;
                    }
                    // Fall back to the original preventive-visit ICDs.
                    const fallbackCodes = ["Z01.00", "Z00.01", "Z00.121"];
                    const fallbackRow = icdRows.find(r => fallbackCodes.includes(getICDCode(r)));
                    if (fallbackRow) {
                        const rowNum = getICDRowNumber(fallbackRow);
                        if (rowNum) setInputValue(getCPTICDInput(row, 1), rowNum);
                        return;
                    }
                    // Last resort: standard office-visit linking.
                    officeVisit([cpt], icdRows, cptRows);
                    return;
                }

                if (rule.type === "customICDCollector") {
                    let matchedRows = [];
                    if (rule.useRowOrder) {
                        // Preserve the order ICDs appear in the claim's ICD grid,
                        // rather than the order they're listed in rule.icdList.
                        matchedRows = icdRows.filter(r => {
                            const val = getICDCode(r);
                            if (!val) return false;
                            return rule.icdList.some(code =>
                                code.includes('.') ? val === code.toUpperCase() : val.startsWith(code.toUpperCase())
                            );
                        });
                    } else {
                        const matchedICDs = matchICDsFromList(rule.icdList, allICDs);
                        matchedRows = matchedICDs
                            .map(icd => icdRows.find(r => getICDCode(r) === icd))
                            .filter(Boolean);
                    }
                    if (matchedRows.length) {
                        matchedRows.slice(0, 4).forEach((icdRow, idx) => {
                            const rowNum = getICDRowNumber(icdRow);
                            if (rowNum) setInputValue(getCPTICDInput(row, idx + 1), rowNum);
                        });
                    } else if (rule.fallback === "officeVisit") {
                        officeVisit([cpt], icdRows, cptRows);
                    }
                    return;
                }

                if (rule.icds) {
                    const icdGroups = Array.isArray(rule.icds[0]) ? rule.icds : [rule.icds];
                    let foundAny = false;
                    icdGroups.forEach((options, idx) => {
                        let found = null;
                        for (const code of options) {
                            const rowMatch = icdRows.find(r => {
                                const icdVal = getICDCode(r);
                                if (!icdVal) return false;
                                return code.length <= 3 ? icdVal.startsWith(code) : icdVal === code;
                            });
                            if (rowMatch) { found = rowMatch; break; }
                        }
                        if (found) {
                            const rowNum = getICDRowNumber(found);
                            if (rowNum) { setInputValue(getCPTICDInput(row, idx + 1), rowNum); foundAny = true; }
                        }
                    });
                    if (!foundAny && rule.fallback === "officeVisit") {
                        officeVisit([cpt], icdRows, cptRows);
                    }
                }
            });
        }
    }

    function handleUnlistedCPTs(cptRows) {
        const icdRows = getICDRows();
        cptRows.forEach(row => {
            const cptCode = getCPTCode(row);
            if (cptCode && !cptRules[cptCode]) {
                officeVisit([cptCode], icdRows, cptRows);
            }
        });
    }

    function alertDuplicateICDStart(icdRows) {
        const prefixesMap = {};
        for (const row of icdRows) {
            const icdVal = getICDCode(row);
            if (!icdVal || icdVal.length < 3) continue;
            const prefix = icdVal.slice(0, 3);
            if (prefix.startsWith("Z")) continue;
            if (!prefixesMap[prefix]) prefixesMap[prefix] = [];
            prefixesMap[prefix].push(icdVal);
        }
        const duplicates = Object.values(prefixesMap).filter(arr => arr.length > 1);
        if (duplicates.length) {
            const msg = duplicates.map(arr => arr.join(", ")).join(" | ");
            showNotification([`Duplicate ICD prefix conflict: ${msg}`], 'yellow');
        }
    }

    // ─── ICD ordering check: diagnosis (non-Z) code below a Z code ──────
    // Z codes (status/history codes) should generally sit at the bottom of
    // the ICD list. If a real diagnosis code is found below a Z code row,
    // warn — this ordering can cause CPTs to miss ICD linking.
    function checkICDOrderZBeforeDx(icdRows) {
        let seenZ = false;
        const outOfOrder = [];
        for (const row of icdRows) {
            const val = getICDCode(row);
            if (!val) continue;
            if (val.startsWith('Z')) {
                seenZ = true;
                continue;
            }
            if (seenZ) outOfOrder.push(val);
        }
        if (outOfOrder.length) {
            const unique = [...new Set(outOfOrder)];
            showNotification([`Diagnosis code(s) ${unique.join(", ")} found below a Z code — reorder ICD list`], 'yellow');
        }
    }

    // ─── Diabetes + Prediabetes conflict check ─────────────────────────
    // If a diabetes ICD (E08-E13 or O24 gestational diabetes) and
    // prediabetes (R73.03) are both present on the claim, warn.
    function checkDiabetesPrediabetesConflict(icdRows) {
        const codes = icdRows.map(getICDCode).filter(Boolean);
        const hasDiabetes = codes.some(code => /^E0[89]|^E1[0-3]|^O24/.test(code));
        const hasPrediabetes = codes.some(code => code === 'R73.03' || code.startsWith('R7303'));
        if (hasDiabetes && hasPrediabetes) {
            showNotification(['Diabetes and Prediabetes (R73.03) both present — remove one'], 'red');
        }
    }

    function alertDuplicateCPT(cptRows) {
        const cptMap = {};
        for (const row of cptRows) {
            const cptVal = getCPTCode(row);
            if (!cptVal) continue;
            if (!cptMap[cptVal]) cptMap[cptVal] = [];
            cptMap[cptVal].push(cptVal);
        }
        const duplicates = Object.values(cptMap).filter(arr => arr.length > 1);
        if (duplicates.length) {
            const msg = duplicates.map(arr => arr[0]).join(", ");
            showNotification([`Duplicate CPT(s) detected: ${msg}`], 'yellow');
        }
    }

    function validatePreventiveCPT(cptRows) {
        const age = getPatientAge();
        if (age === null) return;

        const warnings = [];
        for (const row of cptRows) {
            const cpt = getCPTCode(row);
            if (!cpt || !PREVENTIVE_RULES[cpt]) continue;
            const { min, max } = PREVENTIVE_RULES[cpt];
            if (age < min || age > max) {
                const correct = Object.entries(PREVENTIVE_RULES)
                    .filter(([k, r]) => age >= r.min && age <= r.max)
                    .map(([k]) => k)
                    .join(", ");
                warnings.push(`CPT ${cpt} unsuitable for age ${age}. Suggested: ${correct}`);
            }
        }
        if (warnings.length) showNotification(warnings, 'red');
    }

    // ─── 99214 eligibility check ───────────────────────────────────────
    const EXCLUDED_ICDS = new Set(["E66.9", "E66.01", "E66.09", "E66.3", "F17.210", "F17.200", "F17.220", "E55.9"]);
    const CHRONIC_CODES = new Set([
        "B18.8","I10","E03.8","E03.9","E07.89","E07.9","E11.21","E11.22","E11.40","E11.42","E11.49","E11.59",
        "E11.610","E11.618","E11.65","E11.69","E11.8","E11.9","E44.0","E78.1","E78.2","E78.5",
        "F01.50","F01.51","F03.90","F03.91","F06.30","F06.31","F06.32","F06.4","F20.1","F20.3","F20.9","F31.10",
        "F31.61","F31.9","F32.9","F32.A","F33.0","F33.1","F34.9","F39","F41.1","F41.9","F51.01","F51.12","F52.21",
        "G47.00","G47.09","G89.29","H25.013","H34.8192","I25.10","I25.119","I25.810","I25.812","I25.83","I25.9",
        "I48.91","I50.22","I51.7","I51.9","I67.9","I73.9","I83.10","I83.891","I83.93",
        "J32.0","J44.1","J44.9","J45.20","J45.21","J45.30","J45.40","J45.901","J45.909","J45.991",
        "K21.00","K21.9","K58.0","K58.1","K58.2","K70.31","K74.60","K76.0","K86.0","K86.1","K90.0",
        "L40.9","L74.9","L83","M06.89","M06.9","M10.00","M10.072","M10.9","M47.22","M47.25","M47.26","M79.7","M81.0",
        "N18.2","N18.30","N18.31","N18.32","N18.4","N18.9","N40.0","N40.1","N46.9","N52.9",
        "R00.1","R01.1","R41.81","R54","R87.810","R94.4","R94.5","R94.6","T82.212D"
    ]);

    function extractICDCode(rawText) {
        if (!rawText) return null;
        const match = rawText.trim().match(/^([A-Z][0-9A-Z]{1,3}(?:\.[0-9A-Z]{1,4})?)\b/i);
        return match ? match[1].toUpperCase() : null;
    }

    function checkChronicDiseaseCountFor99214(icdRows) {
        const codes = new Set();
        icdRows.forEach(row => {
            const code = extractICDCode(getICDCode(row));
            if (!code) return;
            if (code.startsWith('Z')) return;
            if (EXCLUDED_ICDS.has(code)) return;
            codes.add(code);
        });

        console.log('[99214 check] counted codes:', Array.from(codes));
        if (codes.size < 4) return;

        const hasChronic = Array.from(codes).some(code => CHRONIC_CODES.has(code));
        if (hasChronic) showNotification(["99214 can be added"], 'blue');
    }

    // ─── L21.x age-appropriateness check ────────────────────────────────
    // Under 18: L21.0 is the expected code — flag L21.9/L21.8 (or any other
    // L21.x) as a mismatch. 18+: L21.9/L21.8 expected — flag L21.0 as a
    // mismatch.
    let lastL21NotifyTime = 0;
    function checkForL21(icdRows) {
        const age = getPatientAge();
        if (age === null) return;

        const l21Codes = icdRows
            .map(row => extractICDCode(getICDCode(row)))
            .filter(code => code && code.startsWith('L21'));
        if (!l21Codes.length) return;

        const uniqueCodes = [...new Set(l21Codes)];
        let mismatched = [];

        if (age < 18) {
            mismatched = uniqueCodes.filter(code => code !== 'L21.0');
            if (mismatched.length) {
                const now = Date.now();
                if (now - lastL21NotifyTime < 2000) return;
                lastL21NotifyTime = now;
                showNotification([`Patient is ${age} (under 18) — use L21.0 instead of ${mismatched.join(", ")}`], 'red');
            }
        } else {
            mismatched = uniqueCodes.filter(code => code === 'L21.0');
            if (mismatched.length) {
                const now = Date.now();
                if (now - lastL21NotifyTime < 2000) return;
                lastL21NotifyTime = now;
                showNotification([`Patient is ${age} (18+) — use L21.9/L21.8 instead of L21.0`], 'red');
            }
        }
    }

    // ─── Malignant neoplasm (C-code) ICD warning ───────────────────────
    // C00-C96 is the malignant neoplasm (cancer) chapter of ICD-10. If any
    // ICD on the claim starts with "C", pop a warning so it gets a second
    // look before submission.
    function checkForCancerICD(icdRows) {
        const cCodes = icdRows
            .map(getICDCode)
            .filter(code => code && code.startsWith('C'));
        if (cCodes.length) {
            const unique = [...new Set(cCodes)];
            showNotification([`ICD code(s) ${unique.join(", ")} start with "C" (malignant neoplasm) — please verify`], 'red');
        }
    }

    // ─── Flu vaccine CPT presence check (90686 / 90688) ────────────────
    function checkForFluVaccineCPTs(cptRows) {
        const targetCodes = new Set(["90686", "90688"]);
        const present = cptRows
            .map(getCPTCode)
            .filter(code => targetCodes.has(code));
        if (present.length) {
            const unique = [...new Set(present)];
            showNotification([`CPT ${unique.join(", ")} present on this claim`], 'red');
        }
    }

    // ─── Telehealth POS rule (Healthfirst / Fidelis / Metroplus) ───────
    // If primary insurance is Healthfirst, Fidelis, or Metroplus, and any
    // CPT row has MOD1 == "93" or "95", set POS to "10" on every CPT row.
    const TELEHEALTH_POS_INSURANCES = ['HEALTHFIRST', 'FIDELIS', 'METROPLUS'];

    function applyHealthfirstTelehealthPOS(cptRows) {
        const primaryName = getPrimaryInsuranceName();
        if (!primaryName) return;
        const upperName = primaryName.toUpperCase();
        const matchesTargetInsurance = /HEALTH\s*FIRST/.test(upperName) ||
            ['FIDELIS', 'METROPLUS'].some(name => upperName.includes(name));
        if (!matchesTargetInsurance) return;

        // MOD1 "93" or "95" can appear on any row, not necessarily the first
        const hasTelehealthMod = cptRows.some(row => {
            const modInput = getCPTMod1Input(row);
            const val = modInput && modInput.value.trim();
            return val === '93' || val === '95';
        });
        if (!hasTelehealthMod) return;

        cptRows.forEach(row => {
            const posInput = getCPTPOSInput(row);
            if (posInput) setInputValue(posInput, '10');
        });

        const claimPOSInput = getClaimLevelPOSInput();
        if (claimPOSInput) setInputValue(claimPOSInput, '10');
    }

    // ─── Telehealth POS rule (Medicaid / CenterLight / NYCE PPO) ───────
    // If primary insurance is Medicaid, CenterLight, or NYCE PPO, and any
    // CPT row has MOD1 == "95", set POS to "02" on every CPT row.
    const MEDICAID_TELEHEALTH_POS_INSURANCES = ['MEDICAID', 'CENTERLIGHT', 'NYCE PPO'];

    function applyMedicaidTelehealthPOS(cptRows) {
        const primaryName = getPrimaryInsuranceName();
        if (!primaryName) return;
        const upperName = primaryName.toUpperCase();
        const matchesTargetInsurance = MEDICAID_TELEHEALTH_POS_INSURANCES.some(name => upperName.includes(name));
        if (!matchesTargetInsurance) return;

        // MOD1 "95" can appear on any row
        const hasMod95 = cptRows.some(row => {
            const modInput = getCPTMod1Input(row);
            return modInput && modInput.value.trim() === '95';
        });
        if (!hasMod95) return;

        cptRows.forEach(row => {
            const posInput = getCPTPOSInput(row);
            if (posInput) setInputValue(posInput, '2');
        });

        const claimPOSInput = getClaimLevelPOSInput();
        if (claimPOSInput) setInputValue(claimPOSInput, '2');
    }

    // ─── Telehealth POS rule (any other insurance) ──────────────────────
    // If primary insurance is NOT one of the six named payers above, and any
    // CPT row has MOD1 == "95", set POS to "10" on every CPT row.
    const NAMED_TELEHEALTH_INSURANCES = [
        ...TELEHEALTH_POS_INSURANCES,
        ...MEDICAID_TELEHEALTH_POS_INSURANCES
    ];

    function applyOtherInsuranceTelehealthPOS(cptRows) {
        const primaryName = getPrimaryInsuranceName();
        if (!primaryName) return;
        const upperName = primaryName.toUpperCase();
        const matchesNamedInsurance = /HEALTH\s*FIRST/.test(upperName) ||
            NAMED_TELEHEALTH_INSURANCES.some(name => upperName.includes(name));
        if (matchesNamedInsurance) return; // one of the six already handled above

        const hasMod95 = cptRows.some(row => {
            const modInput = getCPTMod1Input(row);
            return modInput && modInput.value.trim() === '95';
        });
        if (!hasMod95) return;

        cptRows.forEach(row => {
            const posInput = getCPTPOSInput(row);
            if (posInput) setInputValue(posInput, '10');
        });

        const claimPOSInput = getClaimLevelPOSInput();
        if (claimPOSInput) setInputValue(claimPOSInput, '10');
    }

    // ─── Medicare preventive CPT rule (9939x / 9938x invalid) ──────────
    // If primary insurance is Medicare and a 9939x or 9938x CPT is present,
    // pop a notification telling the user to add G0438/G0439 instead, since
    // those preventive-medicine CPTs are not valid for Medicare billing.
    function checkMedicarePreventiveCPT(cptRows) {
        const primaryName = getPrimaryInsuranceName();
        if (!primaryName) return;
        if (!primaryName.toUpperCase().includes('MEDICARE')) return;

        const invalidCodes = cptRows
            .map(getCPTCode)
            .filter(code => /^9939\d$/.test(code) || /^9938\d$/.test(code));

        if (!invalidCodes.length) return;

        const unique = [...new Set(invalidCodes)];
        showNotification([`Add G0438/G0439 — ${unique.join(", ")} is invalid for Medicare`], 'red');
    }

    // ─── Medicaid CPT count rule (more than 10 CPTs) ───────────────────
    // If primary insurance is Medicaid and there are more than 10 CPT rows
    // on the claim, pop a warning notification.
    function checkMedicaidCPTCount(cptRows) {
        const primaryName = getPrimaryInsuranceName();
        if (!primaryName) return;
        if (!primaryName.toUpperCase().includes('MEDICAID')) return;

        const validCptCount = cptRows.filter(row => getCPTCode(row) && isCPTRowSelected(row)).length;
        if (validCptCount > 10) {
            showNotification([`Medicaid claim has ${validCptCount} selected CPT codes — exceeds limit of 10`], 'red');
        }
    }

    // ─── Unselect specific CPT codes rule ──────────────────────────────
    // If a CPT row's code is one of these, uncheck its "Assign To Patient" checkbox.
    const UNSELECT_CPT_CODES = new Set(["LSM01", "PD001", "CP001", "AST01", "98012"]);
    function unselectLSM01(cptRows) {
        cptRows.forEach(row => {
            if (!UNSELECT_CPT_CODES.has(getCPTCode(row).toUpperCase())) return;
            const chk = row.querySelector('td:nth-child(2) input[type="checkbox"]');
            if (chk && chk.checked) {
                chk.click();
            }
        });
    }

    // ─── Unselect specific CPT codes rule (Healthfirst only) ───────────
    // If primary insurance is Healthfirst, uncheck "Assign To Patient" for
    // 1159F / 1160F rows.
    const HEALTHFIRST_UNSELECT_CODES = new Set(["1159F", "1160F"]);
    function unselectHealthfirstCPTs(cptRows) {
        const primaryName = getPrimaryInsuranceName();
        if (!primaryName) return;
        if (!/HEALTH\s*FIRST/.test(primaryName.toUpperCase())) return;

        cptRows.forEach(row => {
            if (!HEALTHFIRST_UNSELECT_CODES.has(getCPTCode(row).toUpperCase())) return;
            const chk = row.querySelector('td:nth-child(2) input[type="checkbox"]');
            if (chk && chk.checked) {
                chk.click();
            }
        });
    }

    // ─── 96372 modifier rule ────────────────────────────────────────────
    // If a CPT row's code is 96372, set MOD1 to "59".
    function setMod59For96372(cptRows) {
        cptRows.forEach(row => {
            if (getCPTCode(row).toUpperCase() !== '96372') return;
            const modInput = getCPTMod1Input(row);
            if (modInput) setInputValue(modInput, '59');
        });
    }

    // ─── 99211 modifier rule ────────────────────────────────────────────
    // If 99211 is on the claim along with at least one other CPT code,
    // set MOD1 to "25" on the 99211 row.
    function setMod25For99211(cptRows) {
        const codes = cptRows.map(row => getCPTCode(row).toUpperCase()).filter(Boolean);
        const has99211 = codes.includes('99211');
        const hasOtherCPT = codes.some(code => code !== '99211');
        if (!has99211 || !hasOtherCPT) return;

        cptRows.forEach(row => {
            if (getCPTCode(row).toUpperCase() !== '99211') return;
            const modInput = getCPTMod1Input(row);
            if (modInput) setInputValue(modInput, '25');
        });
    }

    // ─── G0438/G0439/G0402 modifier removal rule ────────────────────────
    // These wellness/IPPE codes should never carry a MOD1. If any of them
    // has a modifier entered, clear it.
    const WELLNESS_NO_MOD_CODES = new Set(["G0438", "G0439", "G0402"]);
    function removeModForWellnessCodes(cptRows) {
        cptRows.forEach(row => {
            if (!WELLNESS_NO_MOD_CODES.has(getCPTCode(row).toUpperCase())) return;
            const modInput = getCPTMod1Input(row);
            if (modInput && modInput.value.trim() !== '') {
                setInputValue(modInput, '');
            }
        });
    }

    // ─── POS default rule ────────────────────────────────────────────
    // If a CPT row's POS field is still empty after the telehealth POS
    // rules have run (i.e. it wasn't a televisit), fill it with "11"
    // (Office) — the standard default place of service.
    function fillBlankPOS(cptRows) {
        cptRows.forEach(row => {
            const posInput = getCPTPOSInput(row);
            if (posInput && posInput.value.trim() === '') {
                setInputValue(posInput, '11');
            }
        });
    }

    // ─── Billed Fee zero-fix rule ───────────────────────────────────────
    // Category II CPT codes (and sometimes others) get billed at "0.00",
    // which some clearinghouses reject outright. If a row's Billed Fee is
    // exactly 0, bump it to "0.01" (a nominal charge that's accepted).
    function fixZeroBilledFee(cptRows) {
        cptRows.forEach(row => {
            const feeInput = getCPTBilledFeeInput(row);
            if (!feeInput) return;
            const val = feeInput.value.trim();
            if (val !== '' && parseFloat(val) === 0) {
                setInputValue(feeInput, '0.01');
            }
        });
    }

    // ─── TOS default rule ────────────────────────────────────────────
    // If a CPT row's TOS field is empty/blank, fill it with "1".
    function fillBlankTOS(cptRows) {
        cptRows.forEach(row => {
            const tosInput = getCPTTOSInput(row);
            if (tosInput && tosInput.value.trim() === '') {
                setInputValue(tosInput, '1');
            }
        });
    }

    // ─── Main Flow ─────────────────────────────────────────────────────
    function mainFlow() {
        const icdRows = getICDRows();
        const cptRows = getCPTRows();

        linkCPTGeneric(icdRows, cptRows);
        handleUnlistedCPTs(cptRows);
        alertDuplicateICDStart(icdRows);
        checkICDOrderZBeforeDx(icdRows);
        alertDuplicateCPT(cptRows);
        validatePreventiveCPT(cptRows);
        checkChronicDiseaseCountFor99214(icdRows);
        checkForL21(icdRows);
        checkForCancerICD(icdRows);
        checkDiabetesPrediabetesConflict(icdRows);
        checkForFluVaccineCPTs(cptRows);
        checkMedicarePreventiveCPT(cptRows);
        unselectLSM01(cptRows);
        unselectHealthfirstCPTs(cptRows);
        checkMedicaidCPTCount(cptRows);
        setMod59For96372(cptRows);
        setMod25For99211(cptRows);
        removeModForWellnessCodes(cptRows);
        applyHealthfirstTelehealthPOS(cptRows);
        applyMedicaidTelehealthPOS(cptRows);
        applyOtherInsuranceTelehealthPOS(cptRows);
        fillBlankPOS(cptRows);
        fillBlankTOS(cptRows);
        fixZeroBilledFee(cptRows);
    }

    // ─── Boot ──────────────────────────────────────────────────────────
    function waitForTables() {
        if (!document.querySelector("#icdTable") || !document.querySelector("#cptTable")) {
            return setTimeout(waitForTables, 500);
        }
        createButton();
    }

    function createButton() {
        if (document.getElementById("ecwClaimLinkBtn")) return;
        const btn = document.createElement("button");
        btn.id = "ecwClaimLinkBtn";
        btn.innerText = "Claim Link";
        Object.assign(btn.style, {
            position: "fixed", top: "100px", left: "calc(100% - 280px)", padding: "9px 14px",
            zIndex: "999999", background: "#1e3a8a", color: "#fff", fontSize: "13px", border: "none",
            borderRadius: "8px", cursor: "pointer", boxShadow: "0 3px 8px rgba(0,0,0,0.25)", transition: "background 0.3s"
        });
        btn.addEventListener("mouseenter", () => { btn.style.background = "#8c8c8c"; });
        btn.addEventListener("mouseleave", () => { btn.style.background = "#1e3a8a"; });
        btn.addEventListener("click", mainFlow);
        document.body.appendChild(btn);
    }

    waitForTables();
})();
