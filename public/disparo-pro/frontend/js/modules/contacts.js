// ========================================
// 9. GERENCIAMENTO DE CONTATOS
// ========================================
const ContactManager = {
    processExcelFile(file) {
        UI.showLoading('Processando arquivo Excel...');

        const reader = new FileReader();
        reader.onload = (e) => {
            Utils.safeAsyncCall(async () => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                const processedContacts = this.processContactData(jsonData);
                const { uniqueContacts, duplicates } = this.removeDuplicates(processedContacts);

                const validContacts = uniqueContacts.filter(c => c.isValid);
                const invalidContacts = uniqueContacts.filter(c => !c.isValid);

                AppState.contacts = validContacts;

                UI.hideLoading();
                this.showProcessingSummary(processedContacts.length, validContacts.length, duplicates.length, invalidContacts.length);
                this.updateContactsList();
                TimeEstimator.update();

                document.getElementById('fileInfo').style.display = 'block';
                UI.showSuccess(`${AppState.contacts.length} contatos importados com sucesso!`);

                if (typeof SupabaseDataManager !== 'undefined' && AppState.contacts.length > 0) {
                    SupabaseDataManager.saveContacts(AppState.contacts);
                }
            }, 'Erro ao processar arquivo Excel');
        };

        reader.onerror = () => {
            UI.hideLoading();
            UI.showError('Erro ao ler o arquivo');
        };

        reader.readAsArrayBuffer(file);
    },

    processContactData(jsonData) {
        return jsonData.map((row, index) => {
            const name = this.cleanText(row.Nome || row.nome || row.NOME || row.Name || row.name || row.NAME || '');
            const rawPhone = String(row.Telefone || row.telefone || row.TELEFONE || row.Phone || row.phone || row.PHONE || row.Celular || row.celular || row.CELULAR || '');
            const email = this.cleanText(row.Email || row.email || row.EMAIL || row.EMail || row['E-mail'] || row['e-mail'] || row['E-MAIL'] || '');

            const phoneValidation = PhoneUtils.isValidPhone(rawPhone);

            return {
                name,
                phone: phoneValidation.valid ? phoneValidation.formatted : PhoneUtils.formatPhone(rawPhone),
                email,
                rawPhone,
                isValid: phoneValidation.valid,
                error: phoneValidation.error || null,
                row: index + 1,
                validationMode: PhoneUtils.getValidationMode().modeName
            };
        }).filter(contact => contact.name && contact.phone && contact.phone.length >= 4);
    },

    cleanText(text) {
        if (!text) return '';

        let cleanText = String(text).trim();

        try {
            cleanText = cleanText.normalize('NFC');
        } catch (error) {
            console.warn('Erro na normalização de texto:', error);
        }

        return cleanText;
    },

    removeDuplicates(contacts) {
        const seenPhones = new Map();
        const uniqueContacts = [];
        const duplicates = [];

        contacts.forEach(contact => {
            if (seenPhones.has(contact.phone)) {
                duplicates.push({
                    duplicate: contact,
                    original: seenPhones.get(contact.phone),
                    phone: contact.phone
                });
            } else {
                seenPhones.set(contact.phone, contact);
                uniqueContacts.push(contact);
            }
        });

        return { uniqueContacts, duplicates };
    },

    showProcessingSummary(total, valid, duplicates, invalid) {
        const validationMode = PhoneUtils.getValidationMode();

        const summaryText = `
        <div style="text-align: left; line-height: 1.6; padding: 0px 20px">
            <strong>🔧 Modo:</strong> ${validationMode.modeName}<br>
            <strong>📋 Descrição:</strong> ${validationMode.description}<br><br>
            • Total processados: <strong>${total}</strong><br>
            • Contatos válidos: <strong style="color: #28a745;">${valid}</strong><br>
            • Duplicados removidos: <strong style="color: #ffc107;">${duplicates}</strong><br>
            • Inválidos ignorados: <strong style="color: #dc3545;">${invalid}</strong>
        </div>
    `;

        NotificationService.reportSuccess(
            'Resumo do Processamento',
            summaryText,
            'OK',
            {
                width: '550px',
                messageMaxLength: 3000,
                plainText: false,
                titleFontSize: '22px',
                messageFontSize: '14px'
            }
        );
    },

    updateContactsList() {
        const contactsList = document.getElementById('contactsList');
        const contactCount = document.getElementById('contactCount');
        const clearContactsBtn = document.getElementById('clearContactsBtn');
        const exportContactsBtn = document.getElementById('exportContactsBtn');
        const contactBadge = document.getElementById('contactCountBadge');

        console.log('🔄 updateContactsList:', AppState.contacts.length, 'contatos');

        if (!contactsList || !contactCount) return;

        contactCount.textContent = `${AppState.contacts.length} contatos`;

        const totalContactsEl = document.getElementById('totalContacts');
        if (totalContactsEl) {
            totalContactsEl.textContent = AppState.contacts.length;
            console.log(`📊 Dashboard totalContacts = ${AppState.contacts.length}`);
        }

        if (contactBadge) {
            if (AppState.contacts.length > 0) {
                contactBadge.textContent = AppState.contacts.length;
                contactBadge.style.display = 'inline';
            } else {
                contactBadge.textContent = '0';
                contactBadge.style.display = 'none';
            }
        }

        if (AppState.contacts.length === 0) {
            contactsList.innerHTML = '<p class="text-muted text-center mb-0">Importe um arquivo Excel para visualizar os contatos</p>';
            if (clearContactsBtn) clearContactsBtn.style.display = 'none';
            if (exportContactsBtn) exportContactsBtn.style.display = 'none';
            return;
        }

        if (clearContactsBtn) clearContactsBtn.style.display = 'inline-block';
        if (exportContactsBtn) exportContactsBtn.style.display = 'inline-block';

        contactsList.innerHTML = AppState.contacts.map((contact, index) =>
            `<div class="contact-item">
            <div class="d-flex justify-content-between align-items-center">
                <small class="text-muted">#${index + 1}</small>
                <div>
                    <strong>${contact.name}</strong> - ${PhoneUtils.displayFormattedPhone(contact.phone)}
                    ${contact.email ? `<br><small class="text-muted"><i class="bi bi-envelope me-1"></i>${contact.email}</small>` : ''}
                    ${!contact.isValid ? '<span class="badge bg-warning ms-2">Verificar</span>' : ''}
                </div>
            </div>
        </div>`
        ).join('');

        if (typeof AutoSaveManager !== 'undefined' && !AutoSaveManager.isLoading) {
            AutoSaveManager.saveSessionData();
        }
    },

    updateDashboardContactCount() {
        const totalContactsEl = document.getElementById('totalContactsEl');
        if (totalContactsEl && AppState.contacts.length >= 0) {
            totalContactsEl.textContent = AppState.contacts.length;
            totalContactsEl.setAttribute('data-source', 'contacts');
            totalContactsEl.setAttribute('data-updated', Date.now());
            console.log(`✅ Dashboard: ${AppState.contacts.length} contatos (fonte: ContactManager)`);
        }
    },

    updateDashboard() {
        const totalContactsEl = document.getElementById('totalContacts');
        if (totalContactsEl) {
            totalContactsEl.textContent = AppState.contacts.length;
            console.log(`📊 Dashboard atualizado: ${AppState.contacts.length} contatos`);
        }
    },

    revalidateContacts() {
        UI.showLoading('Revalidando contatos com novo modo...');

        console.log('🔄 Revalidando contatos com modo:', PhoneUtils.getValidationMode().modeName);

        const revalidatedContacts = AppState.contacts.map(contact => {
            const phoneValidation = PhoneUtils.isValidPhone(contact.rawPhone || contact.phone);

            return {
                ...contact,
                phone: phoneValidation.valid ? phoneValidation.formatted : PhoneUtils.formatPhone(contact.rawPhone || contact.phone),
                isValid: phoneValidation.valid,
                error: phoneValidation.error || null,
                validationMode: PhoneUtils.getValidationMode().modeName
            };
        });

        const validContacts = revalidatedContacts.filter(c => c.isValid);
        const invalidContacts = revalidatedContacts.filter(c => !c.isValid);

        AppState.contacts = validContacts;

        UI.hideLoading();

        this.showRevalidationSummary(revalidatedContacts.length, validContacts.length, invalidContacts.length);

        this.updateContactsList();
        TimeEstimator.update();
    },

    showRevalidationSummary(total, valid, invalid) {
        const validationMode = PhoneUtils.getValidationMode();

        const summaryText = `
        🔄 <strong>Revalidação Concluída:</strong><br>
        🔧 <strong>Novo Modo:</strong> ${validationMode.modeName}<br><br>
        • Total revalidados: ${total}<br>
        • Válidos no novo modo: ${valid}<br>
        • Inválidos removidos: ${invalid}
    `;

        NotificationService.success(summaryText, {
            timeout: 6000,
            width: '400px'
        });
    },

    clear() {
        UI.confirm(
            'Limpar Lista',
            'Tem certeza que deseja remover todos os contatos da lista?',
            () => {
                AppState.contacts = [];
                this.updateContactsList();
                document.getElementById('fileInfo').style.display = 'none';
                TimeEstimator.update();

                const contactBadge = document.getElementById('contactCountBadge');
                if (contactBadge) {
                    contactBadge.textContent = '0';
                    contactBadge.style.display = 'none';
                }

                UI.showSuccess('Lista de contatos limpa');
            }
        );
    }
};

// ========================================
// 11. GERENCIAMENTO DE PREVIEW
// ========================================
const PreviewManager = {
    update() {
        const message = document.getElementById('message')?.value || '';
        const mediaFile = document.getElementById('mediaFile')?.files[0];
        const previewContent = document.getElementById('previewContent');

        if (!previewContent) return;

        const hasValidFile = mediaFile &&
            mediaFile.size > 0 &&
            mediaFile.name &&
            mediaFile.type;

        if (!message.trim() && !hasValidFile) {
            previewContent.innerHTML = `
            <div class="preview-placeholder">
                <i class="bi bi-chat-text fs-3 mb-2 d-block"></i>
                Digite uma mensagem para visualizar o preview
            </div>
        `;
            return;
        }

        let exampleName = 'João Silva';
        if (AppState.contacts.length > 0) {
            exampleName = AppState.contacts[0].name;
            this.updateContact(exampleName);
        }

        let personalizedMessage = message
            .replace(/{nome}/g, exampleName)
            .replace(/{saudacao}/g, Utils.getSaudacao());

        let previewHTML = '<div class="whatsapp-message text-white">';

        if (hasValidFile) {
            console.log('📎 Adicionando mídia ao preview:', mediaFile.name, mediaFile.type);

            if (mediaFile.type.startsWith('image/')) {
                if (window.location.protocol === 'file:' || !window.supportsBlob) {
                    console.log('📁 Usando FileReader para preview da imagem');

                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const imgElement = previewContent.querySelector('.temp-image-placeholder');
                        if (imgElement) {
                            imgElement.outerHTML = `<img src="${e.target.result}" class="whatsapp-media" alt="Preview da imagem">`;
                        }
                    };
                    reader.readAsDataURL(mediaFile);

                    previewHTML += `<div class="temp-image-placeholder whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                    <i class="bi bi-image fs-1 text-primary"></i>
                </div>`;
                } else {
                    try {
                        let imageUrl = window.currentMediaURL;
                        if (!imageUrl) {
                            imageUrl = URL.createObjectURL(mediaFile);
                            window.currentMediaURL = imageUrl;
                        }
                        previewHTML += `<img src="${imageUrl}" class="whatsapp-media" alt="Preview da imagem">`;
                    } catch (error) {
                        console.error('❌ Erro ao processar imagem:', error);
                        previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                        <i class="bi bi-image fs-1 text-primary"></i>
                    </div>`;
                    }
                }
            } else if (mediaFile.type.startsWith('video/')) {
                if (window.location.protocol === 'file:' || !window.supportsBlob) {
                    console.log('📁 Usando FileReader para preview do vídeo');

                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const videoElement = previewContent.querySelector('.temp-video-placeholder');
                        if (videoElement) {
                            videoElement.outerHTML = `<video controls class="whatsapp-media" style="max-width: 100%; width: 100%; height: auto; border-radius: 10px;"><source src="${e.target.result}" type="${mediaFile.type}"></video>`;
                        }
                    };
                    reader.readAsDataURL(mediaFile);

                    previewHTML += `<div class="temp-video-placeholder whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                    <i class="bi bi-play-circle fs-1 text-primary"></i>
                    </div>`;
                } else {
                    try {
                        let videoUrl = window.currentMediaURL;
                        if (!videoUrl) {
                            videoUrl = URL.createObjectURL(mediaFile);
                            window.currentMediaURL = videoUrl;
                        }
                        previewHTML += `<video controls class="whatsapp-media" style="max-width: 100%; width: 100%; height: auto; border-radius: 10px;"><source src="${videoUrl}" type="${mediaFile.type}"></video>`;
                    } catch (error) {
                        previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                        <i class="bi bi-play-circle fs-1 text-primary"></i>
                        </div>`;
                    }
                }
            } else if (mediaFile.type === 'application/pdf') {
                previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 200px;">
                <div class="text-center">
                    <i class="bi bi-file-pdf fs-1 text-danger"></i>
                    <div class="mt-2 small text-muted">${mediaFile.name}</div>
                </div>
            </div>`;
            } else if (mediaFile.type.startsWith('audio/')) {
                if (window.location.protocol === 'file:' || !window.supportsBlob) {
                    console.log('📁 Usando FileReader para preview do áudio');

                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const audioElement = previewContent.querySelector('.temp-audio-placeholder');
                        if (audioElement) {
                            audioElement.outerHTML = `<audio controls class="whatsapp-media" style="width: 100%; border-radius: 10px;"><source src="${e.target.result}" type="${mediaFile.type}"></audio>`;
                        }
                    };
                    reader.readAsDataURL(mediaFile);

                    previewHTML += `<div class="temp-audio-placeholder whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 60px;">
            <i class="bi bi-music-note fs-1 text-success"></i>
        </div>`;
                } else {
                    try {
                        let audioUrl = window.currentMediaURL;
                        if (!audioUrl) {
                            audioUrl = URL.createObjectURL(mediaFile);
                            window.currentMediaURL = audioUrl;
                        }
                        previewHTML += `<audio controls class="whatsapp-media" style="width: 100%; border-radius: 10px;"><source src="${audioUrl}" type="${mediaFile.type}"></audio>`;
                    } catch (error) {
                        previewHTML += `<div class="whatsapp-media d-flex align-items-center justify-content-center bg-light" style="height: 60px;">
                <i class="bi bi-music-note fs-1 text-success"></i>
            </div>`;
                    }
                }
            } else {
                previewHTML += `<div class="d-flex align-items-center mb-2">
                <i class="bi bi-file-earmark me-2"></i>
                <span>${mediaFile.name}</span>
            </div>`;
            }
        }

        if (message.trim()) {
            const htmlForPreview = personalizedMessage
                .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
                .replace(/_([^_]+)_/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');

            previewHTML += `<div>${htmlForPreview}</div>`;
        }

        previewHTML += `
        <div class="whatsapp-time text-white">
            ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            <i class="bi bi-check2-all"></i>
        </div>
    </div>`;

        previewContent.innerHTML = previewHTML;
    },

    loadImageWithFileReader(file, tempId) {
        const tempElement = document.getElementById(tempId);
        if (!tempElement) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'whatsapp-media';
            img.alt = 'Preview da imagem';
            img.style.cssText = 'max-width: 100%; height: auto; border-radius: 10px;';
            tempElement.parentNode.replaceChild(img, tempElement);
        };
        reader.readAsDataURL(file);
    },

    updateContact(name) {
        const previewAvatar = document.getElementById('previewAvatar');
        const previewContactName = document.getElementById('previewContactName');

        if (previewAvatar) previewAvatar.textContent = name.charAt(0).toUpperCase();
        if (previewContactName) previewContactName.textContent = name;
    }
};

function showMediaPreview(file) {
    const preview = document.getElementById('mediaPreview');
    const content = document.getElementById('mediaPreviewContent');
    const fileName = document.getElementById('mediaFileName');
    const fileSize = document.getElementById('mediaFileSize');

    if (!preview || !content || !fileName || !fileSize) {
        console.warn('⚠️ Elementos de preview não encontrados');
        return;
    }

    const maxSize = 16 * 1024 * 1024;
    if (file.size > maxSize) {
        UI.showError(`Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Máximo permitido: 16MB`);

        const mediaInput = document.getElementById('mediaFile');
        if (mediaInput) {
            mediaInput.value = '';
        }

        preview.style.display = 'none';
        return;
    }

    console.log('📎 Criando preview para:', file.name, file.type, file.size);

    content.innerHTML = '';

    if (window.currentMediaURL) {
        URL.revokeObjectURL(window.currentMediaURL);
        window.currentMediaURL = null;
        console.log('🗑️ URL anterior revogada');
    }

    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;

    if (!window.supportsBlob && window.location.protocol === 'file:') {
        console.log('⚠️ Blob URLs não suportadas em file://, usando FileReader');

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.cssText = 'width: 50px; height: 50px; object-fit: cover; border-radius: 5px;';
                img.alt = 'Preview';
                content.appendChild(img);
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const video = document.createElement('video');
                video.src = e.target.result;
                video.style.cssText = 'width: 50px; height: 50px; object-fit: cover; border-radius: 5px;';
                video.controls = false;
                video.muted = true;
                content.appendChild(video);
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('audio/')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const audio = document.createElement('audio');
                audio.src = e.target.result;
                audio.style.cssText = 'width: 50px; height: 30px;';
                audio.controls = true;
                audio.volume = 0.3;
                content.appendChild(audio);
            };
            reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf') {
            content.innerHTML = '<i class="bi bi-file-pdf fs-2 text-danger"></i>';
        } else {
            content.innerHTML = '<i class="bi bi-file-earmark fs-2 text-secondary"></i>';
        }
    } else {
        const fileURL = URL.createObjectURL(file);
        window.currentMediaURL = fileURL;

        console.log('🔗 Nova URL criada:', fileURL);

        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = fileURL;
            img.style.cssText = 'width: 50px; height: 50px; object-fit: cover; border-radius: 5px;';
            img.alt = 'Preview';

            img.onload = () => {
                console.log('✅ Imagem carregada no preview lateral:', file.name);
            };

            img.onerror = (error) => {
                console.error('❌ Erro ao carregar imagem no preview lateral:', error);
                content.innerHTML = '<i class="bi bi-image fs-2 text-danger"></i>';
            };

            content.appendChild(img);

        } else if (file.type.startsWith('video/')) {
            content.innerHTML = '<i class="bi bi-play-circle fs-2 text-primary"></i>';

        } else if (file.type.startsWith('audio/')) {
            content.innerHTML = '<i class="bi bi-music-note fs-2 text-success"></i>';

        } else if (file.type === 'application/pdf') {
            content.innerHTML = '<i class="bi bi-file-pdf fs-2 text-danger"></i>';

        } else {
            content.innerHTML = '<i class="bi bi-file-earmark fs-2 text-secondary"></i>';
        }
    }

    preview.style.display = 'block';
    console.log('✅ Preview lateral exibido para:', file.name, file.type);
}

function clearMedia() {
    console.log('🗑️ Removendo mídia (preservando texto)...');

    forceCleanAllMedia();

    setTimeout(() => {
        const message = document.getElementById('message')?.value || '';

        PreviewManager.update();

        console.log('✅ Preview atualizado - texto preservado, mídia removida');

        const mediaFile = document.getElementById('mediaFile')?.files[0];
        console.log('📊 Estado após limpeza:', {
            temTexto: !!message.trim(),
            temArquivo: !!mediaFile,
            nomeArquivo: mediaFile?.name || 'nenhum'
        });

    }, 200);

    UI.showInfo('Mídia removida - texto preservado');
}

function forceCleanAllMedia() {
    console.log('🧹 LIMPEZA FORÇADA DE MÍDIA (mantendo texto)');

    if (window.currentMediaURL) {
        URL.revokeObjectURL(window.currentMediaURL);
        window.currentMediaURL = null;
        console.log('🗑️ URL principal revogada');
    }

    const mediaPreview = document.getElementById('mediaPreview');
    const mediaContent = document.getElementById('mediaPreviewContent');
    const mediaFileName = document.getElementById('mediaFileName');
    const mediaFileSize = document.getElementById('mediaFileSize');

    if (mediaPreview) {
        mediaPreview.style.display = 'none';
        console.log('✅ Preview lateral escondido');
    }

    if (mediaContent) {
        const images = mediaContent.querySelectorAll('img[src^="blob:"]');
        images.forEach(img => {
            URL.revokeObjectURL(img.src);
            console.log('🗑️ URL de imagem lateral revogada:', img.src);
        });
        mediaContent.innerHTML = '';
        console.log('✅ Conteúdo do preview lateral limpo');
    }

    if (mediaFileName) mediaFileName.textContent = '';
    if (mediaFileSize) mediaFileSize.textContent = '';

    const previewContent = document.getElementById('previewContent');
    if (previewContent) {
        const allMedia = previewContent.querySelectorAll('img[src^="blob:"], video[src^="blob:"], source[src^="blob:"]');
        allMedia.forEach(element => {
            const src = element.src || element.getAttribute('src');
            if (src && src.startsWith('blob:')) {
                URL.revokeObjectURL(src);
                console.log('🗑️ URL do preview principal revogada:', src);
            }
        });

        console.log('✅ URLs de mídia do preview principal limpas');
    }

    const mediaFile = document.getElementById('mediaFile');
    if (mediaFile) {
        mediaFile.value = '';

        const parent = mediaFile.parentNode;
        const newInput = mediaFile.cloneNode(true);
        newInput.value = '';
        parent.replaceChild(newInput, mediaFile);

        console.log('✅ Apenas campo de arquivo resetado');

        setTimeout(() => {
            const resetInput = document.getElementById('mediaFile');
            if (resetInput) {
                resetInput.addEventListener('change', (e) => {
                    console.log('📎 Novo evento change após reset');
                    const file = e.target.files[0];

                    if (file && file.size > 0) {
                        if (window.currentMediaURL) {
                            URL.revokeObjectURL(window.currentMediaURL);
                            window.currentMediaURL = null;
                        }

                        console.log('📎 Processando novo arquivo:', file.name, file.type);
                        showMediaPreview(file);

                        setTimeout(() => {
                            PreviewManager.update();
                        }, 300);
                    } else {
                        forceCleanAllMedia();
                    }
                });
            }
        }, 100);
    }

    window.lastProcessedFile = null;
    window.currentMediaURL = null;

    console.log('🧹 LIMPEZA DE MÍDIA CONCLUÍDA (texto preservado)');
}

function validateMediaFile() {
    const mediaFile = document.getElementById('mediaFile');
    const preview = document.getElementById('mediaPreview');

    if (!mediaFile || !mediaFile.files || mediaFile.files.length === 0) {
        if (preview) {
            preview.style.display = 'none';
        }
        return false;
    }

    const file = mediaFile.files[0];
    if (!file || file.size === 0) {
        if (preview) {
            preview.style.display = 'none';
        }
        return false;
    }

    return true;
}

window.ContactManager = ContactManager;
if (typeof PreviewManager !== 'undefined') window.PreviewManager = PreviewManager;
