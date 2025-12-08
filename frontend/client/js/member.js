(() => {
	// 把 member.html 的內嵌腳本抽到這裡，僅在會員區塊存在時運行。
	// 為避免同一頁面中出現重複 id 的情況（index.html 嵌入 member.html），
	// 我們以 `#member-section` 為優先 root 範圍，若不存在則回退到 `document`。
	const ROOT = document.getElementById('member-section') || document;
	if (!ROOT.querySelector('#main-content') && !ROOT.querySelector('.member-tabs')) return;

	const rawApiBase = window.SF_API_BASE ? String(window.SF_API_BASE) : '';
	const hintedApiOrigin = window.SF_API_ORIGIN ? String(window.SF_API_ORIGIN) : '';
	const envApiOrigin = window.SF_ENV && typeof window.SF_ENV.API_ORIGIN === 'string' ? window.SF_ENV.API_ORIGIN : '';

	const API_ORIGIN = (() => {
	    const candidate = hintedApiOrigin || envApiOrigin || rawApiBase;
	    if (!candidate) return (window.location && window.location.origin) || '';
	    try {
	        return new URL(candidate, (window.location && window.location.origin) || undefined).origin;
	    } catch (_) {
	        return (window.location && window.location.origin) || '';
	    }
	})();

	const utils = window.SF_UTILS || {};
	const sanitizeUploadUrl = typeof utils.sanitizeUploadUrl === 'function'
		? utils.sanitizeUploadUrl
		: ((value) => (value == null ? '' : String(value).trim()));
	const appendCacheBuster = typeof utils.appendCacheBuster === 'function'
		? utils.appendCacheBuster
		: ((url) => (url ? String(url) : ''));

	function safeAppendCacheBuster(url, version) {
		if (!url) return '';
		try {
			const s = String(url);
			if (s.indexOf('?v=') >= 0) return s;
			const sep = s.includes('?') ? '&' : '?';
			const token = encodeURIComponent(version || Date.now());
			return s + sep + 'v=' + token;
		} catch (_) {
			return String(url);
		}
	}
	const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
	const storedCustomerName = localStorage.getItem('customerName') || '';
	const role = (localStorage.getItem('sf-client-role') || localStorage.getItem('userRole') || 'customer').toLowerCase();

	function detectCustomerId() {
		try {
			const candidates = [
				localStorage.getItem('customerId'),
				localStorage.getItem('sf-client-id'),
				localStorage.getItem('sf-clientId'),
				localStorage.getItem('sfClientId'),
				window.SF_CLIENT_ID,
				window.sfClientId,
				window.cid
			];
			for (const v of candidates) {
				if (v != null) {
					const s = String(v).trim();
					if (s) return s;
				}
			}
		} catch (_) {}
		try {
			const params = new URLSearchParams(window.location.search || '');
			const q = params.get('cid') || params.get('customerId');
			if (q && String(q).trim()) return String(q).trim();
		} catch (_) {}
		return null;
	}

	let cid = detectCustomerId();
	if (cid) {
		try { localStorage.setItem('customerId', cid); localStorage.setItem('sf-client-id', cid); } catch (_) {}
		try { window.cid = cid; } catch (_) {}
		try { window.SF_CLIENT_ID = cid; } catch (_) {}
	} else {
		window.cid = null; window.SF_CLIENT_ID = null;
	}

	const feedbackPanel = ROOT.querySelector('#profile-feedback');
	const profileForm = ROOT.querySelector('#profile-form');
	const profileNameInput = ROOT.querySelector('#profile-name');
	const profileEmailInput = ROOT.querySelector('#profile-email');
	const profilePhoneInput = ROOT.querySelector('#profile-phone');
	const profileAddressInput = ROOT.querySelector('#profile-address');
	const profileIdInput = ROOT.querySelector('#profile-id');
	const profileUpdatedEl = ROOT.querySelector('#profile-updated');
	const profileResetBtn = ROOT.querySelector('#profile-reset');
	const avatar = ROOT.querySelector('#profile-avatar');
	const avatarImg = ROOT.querySelector('#profile-avatar-img');
	const avatarInitial = ROOT.querySelector('#profile-avatar-initial');
	const avatarFileInput = ROOT.querySelector('#avatar-file');
	const btnRefresh = ROOT.querySelector('#btn-refresh');
	const btnShowMore = ROOT.querySelector('#btn-show-more');
	const filterKeyword = ROOT.querySelector('#filter-keyword');
	const filterStatus = ROOT.querySelector('#filter-status');
	const filterRange = ROOT.querySelector('#filter-range');
	const ordersTab = ROOT.querySelector('#orders-tab');
	const ordersPanel = ROOT.querySelector('#orders-panel');

	let currentProfile = null;
	let allOrders = [];
	let hasLoadedOrders = false;
	let isLoadingOrders = false;
	let visibleCount = 10;
	let keywordValue = '';
	let statusValue = '';
	let rangeValue = '';

	function clearAvatarPreview() {
		if (avatar) avatar.classList.remove('has-image');
		if (avatarImg) { avatarImg.classList.add('d-none'); avatarImg.removeAttribute('src'); }
		if (avatarInitial) avatarInitial.classList.remove('d-none');
	}

	if (avatarImg) {
		avatarImg.loading = 'lazy'; avatarImg.decoding = 'async';
		avatarImg.addEventListener('error', () => { clearAvatarPreview(); try { localStorage.removeItem('sf-client-avatar'); } catch (_) {} });
	}

	function lockDownMemberUI(message, tone = 'warning', redirectUrl) {
		if (feedbackPanel) { feedbackPanel.className = `alert alert-${tone} mb-3`; feedbackPanel.textContent = message; }
		if (profileForm) profileForm.querySelectorAll('input, textarea, button, select').forEach((el) => { el.setAttribute('disabled', 'disabled'); });
		if (btnRefresh) btnRefresh.setAttribute('disabled', 'disabled');
		if (btnShowMore) btnShowMore.setAttribute('disabled', 'disabled');
		if (avatar) { avatar.setAttribute('aria-disabled', 'true'); avatar.setAttribute('tabindex', '-1'); }
		const ordersContainer = document.getElementById('orders-container');
		if (ordersContainer) ordersContainer.innerHTML = `<div class="alert alert-info mb-0 text-center">${message}</div>`;
		if (redirectUrl) setTimeout(() => { try { window.location.href = redirectUrl; } catch (_) { window.location.assign(redirectUrl); } }, 1600);
	}

	// Only enforce member-only redirects when the user is actively viewing the member area.
	// This file is loaded on both the standalone `member.html` and on the homepage (as a tab).
	// To avoid redirecting guests who are browsing the homepage, only lock down when:
	//  - the current pathname is the standalone member page, OR
	//  - the current location hash explicitly requests the member section (#member)
	const pathname = (window.location && window.location.pathname) ? String(window.location.pathname) : '';
	const isStandaloneMemberPage = pathname.toLowerCase().endsWith('/member.html') || pathname.toLowerCase().endsWith('member.html');
	const wantsMemberSection = (window.location && String(window.location.hash || '').replace('#','') === 'member');

	if (isStandaloneMemberPage || wantsMemberSection) {
		if (role !== 'customer') {
			const redirectTarget = role === 'admin' ? '../admin/index.html' : '../login.html';
			lockDownMemberUI('請使用會員帳號登入以檢視會員中心，系統將為您導向適當頁面。', 'warning', redirectTarget);
			return;
		}

		if (!cid) {
			lockDownMemberUI('請先登入會員帳號以檢視會員中心。', 'warning', '../login.html');
			return;
		}
	}

	function resolveAssetUrl(path) {
		if (!path) return '';
		const sanitized = sanitizeUploadUrl(path);
		if (/^data:/i.test(sanitized)) return String(sanitized);
		if (/^https?:\/\//i.test(sanitized)) return sanitized;
		const clean = String(sanitized).replace(/^\/+/, '');
		const isUploadLike = /^uploads\//i.test(clean);
		const prefixed = sanitized.startsWith('/') || isUploadLike ? `/${clean}` : clean;
		const normalizedPrefixed = prefixed.replace(/^\/+/, '/');
		const lowerPrefixed = normalizedPrefixed.toLowerCase();
		const isUpload = lowerPrefixed.startsWith('/uploads/');
		const isFrontendAsset = lowerPrefixed.startsWith('frontend/') || lowerPrefixed.startsWith('/frontend/');
		const frontendOrigin = (window.location && window.location.origin) || API_ORIGIN;
		// 使用 typeof 檢查以避免在某些執行環境中觸發 ReferenceError
		const storageOrigin = (typeof STORAGE_ORIGIN !== 'undefined' && STORAGE_ORIGIN) ? STORAGE_ORIGIN : API_ORIGIN;
		const base = isUpload ? storageOrigin : (isFrontendAsset ? frontendOrigin : API_ORIGIN);
		if (!base) return normalizedPrefixed;
		const normalizedBase = base.replace(/\/+$/, '');
		const joined = normalizedPrefixed.startsWith('/') ? `${normalizedBase}${normalizedPrefixed}` : `${normalizedBase}/${normalizedPrefixed}`;
		return joined.replace(/\/api(?=\/uploads\/)/gi, '');
	}

	function getStoredAvatarUrl() {
		try { const stored = localStorage.getItem('sf-client-avatar') || ''; return sanitizeUploadUrl(stored); } catch (_) { return ''; }
	}

	function showFeedback(message, tone = 'info') { if (!feedbackPanel) return; if (!message) { feedbackPanel.className = 'alert d-none'; feedbackPanel.textContent = ''; return; } feedbackPanel.className = `alert alert-${tone} mb-3`; feedbackPanel.textContent = message; }

	function applyProfile(data) {
		currentProfile = data;
		const displayName = data.displayName || data.name || storedCustomerName;
		if (profileNameInput) profileNameInput.value = displayName || '';
		if (profileEmailInput) profileEmailInput.value = data.email || (localStorage.getItem('sf-client-email') || '');
		if (profilePhoneInput) profilePhoneInput.value = data.phone || (localStorage.getItem('sf-client-phone') || '');
		if (profileAddressInput) profileAddressInput.value = data.address || (localStorage.getItem('sf-client-address') || '');
		if (profileIdInput) profileIdInput.value = data.customerId || cid || '';
		if (avatarInitial) { const initial = (displayName || 'M').trim().charAt(0).toUpperCase() || 'M'; avatarInitial.textContent = initial; }
		const previousStoredAvatar = getStoredAvatarUrl();
		const avatarKeys = ['avatarUrlResolved', 'avatarUrl', 'avatarUrlOriginal', 'avatar', 'avatarPath'];
		const hasAvatarKey = avatarKeys.some((key) => Object.prototype.hasOwnProperty.call(data, key));
		const avatarCandidates = avatarKeys.map((key) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : undefined));
		if (!hasAvatarKey && previousStoredAvatar) avatarCandidates.push(previousStoredAvatar);
		let avatarUrl = '';
		for (const candidate of avatarCandidates) {
			if (!candidate || candidate === 'null' || candidate === 'undefined') continue;
			const resolved = resolveAssetUrl(candidate);
			if (resolved) { avatarUrl = resolved; break; }
		}
		const sanitizedAvatar = sanitizeUploadUrl(avatarUrl);
		let storedProfileVersion = '';
		try { storedProfileVersion = localStorage.getItem('sf-client-profile-version') || ''; } catch (_) { storedProfileVersion = ''; }
		let avatarVersion = data.updatedAt ? String(data.updatedAt) : storedProfileVersion;
		if (!avatarVersion && sanitizedAvatar && sanitizedAvatar !== previousStoredAvatar) avatarVersion = String(Date.now());
		const finalAvatarUrl = avatarUrl ? safeAppendCacheBuster(avatarUrl, avatarVersion) : '';
		data.avatarUrlResolved = finalAvatarUrl || '';
		if (sanitizedAvatar) data.avatarUrl = sanitizedAvatar; else if (hasAvatarKey) data.avatarUrl = '';
		if (!finalAvatarUrl) { try { localStorage.removeItem('sf-client-avatar'); localStorage.removeItem('sf-client-avatar-resolved'); } catch (_) {} }
		data.avatarVersion = avatarVersion || '';
		if (avatar && avatarImg) {
			const candidates = [];
			try { if (finalAvatarUrl) candidates.push(finalAvatarUrl); } catch (_) {}
			try { const storedResolved = (localStorage.getItem('sf-client-avatar-resolved') || '').trim(); if (storedResolved && storedResolved.toLowerCase() !== 'null' && storedResolved.toLowerCase() !== 'undefined' && !candidates.includes(storedResolved)) candidates.push(storedResolved); } catch (_) {}
			try {
				if (sanitizedAvatar && sanitizedAvatar.toLowerCase() !== 'null' && sanitizedAvatar.toLowerCase() !== 'undefined') {
					if (!/^https?:\/\//i.test(sanitizedAvatar)) {
						const clean = sanitizedAvatar.replace(/^\/*/, '');
						if (typeof STORAGE_ORIGIN === 'string' && STORAGE_ORIGIN) {
							const u = STORAGE_ORIGIN.replace(/\/$/, '') + '/' + clean;
							if (!candidates.includes(u)) candidates.push(u);
						}
						if (typeof window !== 'undefined' && window.location && window.location.origin) {
							const u2 = window.location.origin.replace(/\/$/, '') + '/' + clean;
							if (!candidates.includes(u2)) candidates.push(u2);
						}
					} else {
						if (!candidates.includes(sanitizedAvatar)) candidates.push(sanitizedAvatar);
					}
				}
			} catch (_) {}
			if (candidates.length === 0) { clearAvatarPreview(); } else {
				(function tryLoad(i) {
					if (i >= candidates.length) { clearAvatarPreview(); return; }
					const candidate = candidates[i];
					if (!candidate) { tryLoad(i + 1); return; }
					const url = safeAppendCacheBuster(candidate, avatarVersion || Date.now());
					if (!url) { tryLoad(i + 1); return; }
					avatar.classList.add('has-image'); avatarImg.classList.remove('d-none'); if (avatarInitial) avatarInitial.classList.add('d-none');
					avatarImg.onerror = () => { avatarImg.onerror = null; if (i + 1 < candidates.length) { tryLoad(i + 1); return; } try { const fallback = resolveAssetUrl('/frontend/images/avatars/default-avatar.png') || resolveAssetUrl('/frontend/images/branding/%E9%9B%B6%E9%A3%9F%E6%A3%AE%E6%9E%97LOGO.png') || '/default-avatar.png'; const fallbackUrl = safeAppendCacheBuster(fallback, Date.now()); if (!avatarImg.src || avatarImg.src !== fallbackUrl) { avatarImg.src = fallbackUrl; } } catch (_) { avatarImg.removeAttribute('src'); clearAvatarPreview(); } };
					avatarImg.onload = () => { avatarImg.onerror = null; avatarImg.onload = null; };
					if (!avatarImg.src || avatarImg.src !== url) { avatarImg.src = url; }
				})(0);
			}
		}
		if (profileUpdatedEl) { if (data.updatedAt) { try { profileUpdatedEl.textContent = '最後更新：' + new Date(data.updatedAt).toLocaleString('zh-TW'); } catch (_) { profileUpdatedEl.textContent = ''; } } else { profileUpdatedEl.textContent = ''; } }
		if (displayName && displayName !== storedCustomerName) { localStorage.setItem('customerName', displayName); } else if (!displayName) { localStorage.removeItem('customerName'); }
		try {
			if (displayName) {
				localStorage.setItem('sf-client-name', displayName);
			} else {
				localStorage.removeItem('sf-client-name');
			}
			if (cid) {
				localStorage.setItem('sf-client-id', cid);
			} else {
				localStorage.removeItem('sf-client-id');
			}
			if (sanitizedAvatar) {
				localStorage.setItem('sf-client-avatar', sanitizedAvatar);
				localStorage.setItem('sf-client-avatar-resolved', finalAvatarUrl);
			} else {
				localStorage.removeItem('sf-client-avatar');
				localStorage.removeItem('sf-client-avatar-resolved');
			}
			if (avatarVersion) {
				localStorage.setItem('sf-client-profile-version', String(avatarVersion));
				localStorage.setItem('sf-client-profile-sync', String(Date.now()));
			} else {
				localStorage.removeItem('sf-client-profile-version');
				localStorage.removeItem('sf-client-profile-sync');
			}
			// 同步常見欄位作為立即顯示的備援
			try { if (data.email) localStorage.setItem('sf-client-email', data.email); else localStorage.removeItem('sf-client-email'); } catch(_){}
			try { if (data.phone) localStorage.setItem('sf-client-phone', data.phone); else localStorage.removeItem('sf-client-phone'); } catch(_){}
			try { if (data.address) localStorage.setItem('sf-client-address', data.address); else localStorage.removeItem('sf-client-address'); } catch(_){}
		} catch (_) {}
		try { const detail = { name: displayName || '', avatarUrl: sanitizedAvatar || '', avatarUrlResolved: finalAvatarUrl || '', avatarVersion: avatarVersion || '', updatedAt: data.updatedAt || '', customerId: cid || '' }; window.dispatchEvent(new CustomEvent('sf:profile-updated', { detail })); window.dispatchEvent(new CustomEvent('avatar-updated', { detail })); } catch (_) {}
	}

	let _isLoadingProfile = false;
	const _apiGetCustomerProfile = (window.api && typeof window.api.getCustomerProfile === 'function') ? window.api.getCustomerProfile.bind(window.api) : null;

	async function loadProfile() {
		if (!cid || !_apiGetCustomerProfile) { applyProfile({ customerId: cid, displayName: storedCustomerName }); return; }
		if (_isLoadingProfile) return;
		_isLoadingProfile = true;
		try {
			const res = await _apiGetCustomerProfile(cid);
			if (!res.success) throw new Error(res.error || '無法取得會員資料');
			const profile = res.data || {};
			profile.customerId = cid;
			applyProfile(profile);
			showFeedback('');
		} catch (err) { console.error('載入會員資料失敗', err); showFeedback(err.message || '無法載入會員資料', 'danger'); }
		finally { _isLoadingProfile = false; }
	}

	window.loadAvatar = async function() { try { await loadProfile(); try { console.debug('[SF-avatar-debug] loadAvatar() called'); } catch (_) {} } catch (e) { try { console.warn('[SF-avatar-debug] loadAvatar failed', e); } catch (_) {} } };

	// Expose loadOrders so SPA router can trigger order loading when member section is shown
	try { window.loadOrders = typeof loadOrders === 'function' ? loadOrders : null; } catch (_) { window.loadOrders = null; }

	function readFileAsBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { const result = reader.result; if (typeof result === 'string') { const commaIndex = result.indexOf(','); resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result); } else { reject(new Error('無法讀取檔案內容')); } }; reader.onerror = () => reject(new Error('讀取檔案時發生錯誤')); reader.readAsDataURL(file); }); }

	async function uploadAvatar(file) { if (!file || !cid) return; if (file.size > MAX_AVATAR_SIZE) { showFeedback('頭像檔案過大，請選擇 5MB 以下的圖片。', 'warning'); return; } if (!window.api || typeof window.api.updateCustomerProfile !== 'function') { showFeedback('系統尚未初始化完成，請稍後再試。', 'warning'); return; } showFeedback('頭像上傳中，請稍候...', 'info'); try { const base64 = await readFileAsBase64(file); const payload = { customerId: cid, avatarFileName: file.name, avatarContentType: file.type || 'application/octet-stream', avatarData: base64 }; const res = await window.api.updateCustomerProfile(payload); if (!res.success) throw new Error(res.error || '上傳頭像失敗'); const profile = res.data || {}; profile.customerId = cid; if (typeof window.loadAvatar === 'function') { try { await window.loadAvatar(); } catch (_) { try { location.reload(); } catch (__) { window.location.reload(); } } try { showFeedback('頭像已更新完成。', 'success'); } catch (_) {} } else { try { location.reload(); } catch (_) { window.location.reload(); } } } catch (err) { console.error('頭像上傳失敗', err); showFeedback(err.message || '頭像更新失敗，請稍後再試。', 'danger'); } }

	if (avatar && avatarFileInput) {
		const openPicker = () => avatarFileInput.click();
		avatar.addEventListener('click', openPicker);
		avatar.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); } });
		avatarFileInput.addEventListener('change', () => { const file = avatarFileInput.files && avatarFileInput.files[0]; if (file) uploadAvatar(file); avatarFileInput.value = ''; });
	}

	if (profileForm) {
		profileForm.addEventListener('submit', async (event) => {
			event.preventDefault();
			if (!cid || !window.api || typeof window.api.updateCustomerProfile !== 'function') { showFeedback('系統尚未初始化完成，請稍後再試。', 'warning'); return; }
			const payload = { customerId: cid, displayName: (profileNameInput?.value || '').trim() || null, email: (profileEmailInput?.value || '').trim() || null, phone: (profilePhoneInput?.value || '').trim() || null, address: (profileAddressInput?.value || '').trim() || null };
			try { showFeedback('正在儲存資料...', 'info'); const res = await window.api.updateCustomerProfile(payload); if (!res.success) throw new Error(res.error || '儲存失敗'); const profile = res.data || {}; profile.customerId = cid; applyProfile(profile); showFeedback('會員資料已更新。', 'success'); } catch (err) { console.error('儲存會員資料失敗', err); showFeedback(err.message || '儲存失敗，請稍後再試。', 'danger'); }
		});
	}

	if (profileResetBtn) { profileResetBtn.addEventListener('click', () => { applyProfile(currentProfile || { customerId: cid, displayName: storedCustomerName }); showFeedback('已還原為上次儲存的資料。', 'info'); }); }

	function toNumber(n) { if (n == null) return 0; if (typeof n === 'number') return n; if (typeof n === 'string') { const value = Number(n.replace(/[\,\s]/g, '')); return Number.isNaN(value) ? 0 : value; } return 0; }
	function fmtPrice(n) { try { return 'NT$' + Number(toNumber(n) || 0).toLocaleString('zh-TW'); } catch (_) { return 'NT$0'; } }
	function parseDate(v) { if (v == null) return null; try { if (typeof v === 'number') return new Date(v); const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? null : d; } catch (_) { return null; } }
	function fmtDate(v) { const d = parseDate(v); return d ? d.toLocaleString('zh-TW') : ''; }
	function resolveStatus(order) { const raw = (order.status || '').toString().toLowerCase(); if (raw.includes('ship')) return { key: 'shipped', text: '已出貨' }; if (raw.includes('complete') || raw.includes('finish')) return { key: 'completed', text: '已完成' }; return { key: 'processing', text: '處理中' }; }
	function computeStats(list) { const totalCount = list.length; const totalAmount = list.reduce((sum, order) => sum + toNumber(order.totalAmount), 0); const latest = list.reduce((acc, order) => { const current = parseDate(order.orderDate); if (!current) return acc; if (!acc || current > acc) return current; return acc; }, null); const countEl = ROOT.querySelector('#stat-orders-count'); const totalEl = ROOT.querySelector('#stat-total-amount'); const lastEl = ROOT.querySelector('#stat-last-order'); if (countEl) countEl.textContent = String(totalCount); if (totalEl) totalEl.textContent = fmtPrice(totalAmount); if (lastEl) lastEl.textContent = latest ? latest.toLocaleString('zh-TW') : '--'; }
	function matchKeyword(order, keyword) { if (!keyword) return true; const term = keyword.trim().toLowerCase(); if (!term) return true; if (String(order.id).toLowerCase().includes(term)) return true; if (Array.isArray(order.details)) { return order.details.some((detail) => (detail.productName || '').toString().toLowerCase().includes(term)); } return false; }
	function statusMatch(order, key) { if (!key) return true; return resolveStatus(order).key === key; }
	function inRange(order, days) { if (!days) return true; const d = parseDate(order.orderDate); if (!d) return false; const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24); return diff <= Number(days); }
	function renderEmpty() { const container = ROOT.querySelector('#orders-container'); if (!container) return; container.innerHTML = `<div class="orders-empty text-center text-muted py-5"><div class="fs-1 mb-3"><i class="fa-regular fa-folder-open"></i></div><p class="mb-0">目前沒有符合條件的訂單</p></div>`; }
	function renderOrders(list) { const container = ROOT.querySelector('#orders-container'); const btnMore = ROOT.querySelector('#btn-show-more'); if (!container || !btnMore) return; container.innerHTML = ''; if (!list.length) { renderEmpty(); btnMore.classList.add('d-none'); computeStats([]); return; } computeStats(list); const slice = list.slice(0, visibleCount); btnMore.classList.toggle('d-none', slice.length >= list.length); slice.forEach((order) => { const details = Array.isArray(order.details) ? order.details : []; const total = toNumber(order.totalAmount); const status = resolveStatus(order); const card = document.createElement('div'); card.className = 'card order-card'; const rows = details.map((detail) => `<tr><td>${detail.productName || ''}</td><td class="text-center">${detail.quantity || 0}</td><td class="text-end">${fmtPrice(detail.priceAtTimeOfPurchase || detail.price || 0)}</td></tr>`).join(''); const tableHtml = details.length ? `<div class="table-responsive"><table class="table table-sm align-middle order-items-table mb-0"><thead><tr><th>商品</th><th class="text-center">數量</th><th class="text-end">單價</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="text-muted small">此訂單無明細</div>'; const collapseId = `order-${order.id}`; card.innerHTML = `<div class="card-header order-header d-flex justify-content-between align-items-center"><div><div class="fw-semibold">訂單編號 #${order.id}</div><div class="text-muted small">${fmtDate(order.orderDate)}</div></div><div class="text-end"><div class="fw-bold text-primary">${fmtPrice(total)}</div><span class="badge badge-status ${status.key}">${status.text}</span></div></div><div class="card-body"><div class="d-flex justify-content-between align-items-center mb-3"><div class="small text-muted">配送：${order.shippingMethod || ''} / 付款：${order.paymentMethod || ''}</div><button class="btn btn-outline-secondary btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">查看明細</button></div><div class="collapse show" id="${collapseId}"><div class="row g-3"><div class="col-lg-8">${tableHtml}</div><div class="col-lg-4"><div class="border rounded p-3 bg-light"><div class="small text-muted mb-2">收件資訊</div><div class="mb-1">姓名：${order.recipientName || ''}</div><div class="mb-1">電話：${order.recipientPhone || ''}</div><div class="mb-0">地址：${order.recipientAddress || ''}</div></div></div></div></div></div>`; container.appendChild(card); }); }
	function showLoadingSkeleton() { const container = ROOT.querySelector('#orders-container'); if (!container) return; container.innerHTML = `<div class="card p-4"><div class="skeleton mb-2 skel-h18-w220"></div><div class="skeleton mb-2 skel-h12-w160"></div><div class="skeleton skel-h64"></div></div>`; }
	function currentFiltered() { const list = allOrders.slice(); return list.filter((order) => matchKeyword(order, keywordValue) && statusMatch(order, statusValue) && inRange(order, rangeValue)); }
	function applyFilters(resetVisible) { if (resetVisible) visibleCount = 10; renderOrders(currentFiltered()); }
	async function loadOrders(options = {}) { if (isLoadingOrders) return; const force = options && options.force === true; // 若此 script 在首頁（index.html）被載入，member 區塊可能是以 `sf-hidden` 隱藏 — 避免在隱藏區塊渲染造成視覺上空白
		try {
			const memberSection = ROOT.querySelector('#member-section');
			if (!force && memberSection && memberSection.classList.contains('sf-hidden')) {
				// 不在可見的 member 區塊時略過載入，除非 caller 明確要求 force
				isLoadingOrders = false;
				hasLoadedOrders = false;
				return;
			}
		} catch (_) {}
		if (!force && hasLoadedOrders) { applyFilters(false); return; } isLoadingOrders = true; const container = ROOT.querySelector('#orders-container'); if (container) showLoadingSkeleton(); if (!window.api || typeof window.api.getOrders !== 'function') { computeStats([]); renderOrders([]); isLoadingOrders = false; hasLoadedOrders = false; return; } try { const res = await window.api.getOrders(); if (!res.success) throw new Error(res.error || '無法取得訂單'); let list = Array.isArray(res.data) ? res.data : []; if (role === 'customer' && cid != null) { list = list.filter((order) => String(order.customerId) === String(cid)); } list.sort((a, b) => { const da = parseDate(a.orderDate)?.getTime() || 0; const db = parseDate(b.orderDate)?.getTime() || 0; return db - da; }); allOrders = list; hasLoadedOrders = true; applyFilters(true); } catch (err) { console.error('載入訂單失敗', err); if (container) container.innerHTML = `<div class="alert alert-danger">${err.message || '載入訂單失敗'}</div>`; computeStats([]); hasLoadedOrders = false; } isLoadingOrders = false; }
	if (filterKeyword) { filterKeyword.addEventListener('input', (event) => { keywordValue = event.target.value || ''; applyFilters(true); }); }
	if (filterStatus) { filterStatus.addEventListener('change', (event) => { statusValue = event.target.value || ''; applyFilters(true); }); }
	if (filterRange) { filterRange.addEventListener('change', (event) => { rangeValue = event.target.value || ''; applyFilters(true); }); }
	if (btnRefresh) { btnRefresh.addEventListener('click', () => loadOrders({ force: true })); }
	if (btnShowMore) { btnShowMore.addEventListener('click', () => { visibleCount += 10; applyFilters(false); }); }
	if (ordersTab) { ordersTab.addEventListener('shown.bs.tab', () => { loadOrders(); }); }
	document.addEventListener('DOMContentLoaded', () => { applyProfile({ customerId: cid, displayName: storedCustomerName }); loadProfile(); if (window.location.hash === '#orders') { if (ordersTab && window.bootstrap?.Tab) { window.bootstrap.Tab.getOrCreateInstance(ordersTab).show(); } else { ordersTab?.classList.add('active'); ordersPanel?.classList.add('show', 'active'); loadOrders({ force: true }); } } }, { once: true });
})();
