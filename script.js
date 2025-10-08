// Mostra l'area di upload
function mostraUpload() {
  const container = document.getElementById("uploadContainer"); // Prendo il container dell'upload
  container.style.display = "block"; // Lo rendo visibile (display block)
  setTimeout(() => container.classList.add("show"), 10); // Aggiungo classe "show" dopo 10ms (per animazioni)
}

// Gestisce il caricamento dei file da input file
function gestisciFile(files) {
  if (!files.length) return;

  const regexChat = /\[\d{2}\/\d{2}\/\d{2}, \d{2}:\d{2}:\d{2}\] .+/;

  // Recupera file già esistenti da localStorage
  const salvati = JSON.parse(localStorage.getItem("multiChatFiles") || "[]");
  const nomiSalvati = salvati.map((f) => f.name);

  // Filtra solo i nuovi (non duplicati per nome)
  const nuovi = Array.from(files).filter(
    (f) =>
      f.name.toLowerCase().endsWith(".txt") && !nomiSalvati.includes(f.name)
  );

  const letture = nuovi.map((file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({ name: file.name, contenuto: e.target.result });
      };
      reader.readAsText(file);
    });
  });

  Promise.all(letture).then((nuoviFile) => {
    const tutti = [...salvati, ...nuoviFile];

    // Classifica file
    let chatFiles = [];
    let textFiles = [];

    for (const file of tutti) {
      if (regexChat.test(file.contenuto)) {
        chatFiles.push(file);
      } else {
        textFiles.push(file);
      }
    }

    // Caso misto
    if (chatFiles.length > 0 && textFiles.length > 0) {
      const tutti = [...chatFiles, ...textFiles];
      localStorage.setItem("multiMixedFiles", JSON.stringify(tutti));
      localStorage.setItem("tipoDocumento", "misto");

      document.getElementById("btn-opzioni").classList.remove("disabled");
      document.getElementById("btn-opzioni").removeAttribute("title");

      const lang = localStorage.getItem("lingua") || "it";
      const t = {
        it: {
          risultato: `Sono stati selezionati ${tutti.length} file (chat e testo).`,
          avanti: "Avanti",
        },
        en: {
          risultato: `${tutti.length} files selected (chat and text).`,
          avanti: "Next",
        },
      }[lang];

      document.getElementById("risultato").innerHTML = `
    <p class="analisi-risultato">${t.risultato}</p>
    <button class="btn-avanti" onclick="vaiElaborazioneMista()">${t.avanti}</button>
  `;
      return;
    }

    // Solo chat
    if (chatFiles.length >= 1) {
      localStorage.setItem("multiChatFiles", JSON.stringify(chatFiles));
      localStorage.setItem("multiChatMode", "true");
      localStorage.removeItem("chatContent");
      aggiornaAreaTesto(chatFiles);

      document.getElementById("btn-opzioni").classList.remove("disabled");
      document.getElementById("btn-opzioni").removeAttribute("title");

      const lang = localStorage.getItem("lingua") || "it";
      const t = {
        it: {
          risultato:
            chatFiles.length === 1
              ? "È stato selezionato un file di chat."
              : "Sono stati selezionati più file di chat.",
          avanti: "Avanti",
        },
        en: {
          risultato:
            chatFiles.length === 1
              ? "One chat file selected."
              : "Multiple chat files selected.",
          avanti: "Next",
        },
      }[lang];

      document.getElementById("risultato").innerHTML = `
        <p class="analisi-risultato">${t.risultato}</p>
        <button class="btn-avanti" onclick="vaiElaborazione()">${t.avanti}</button>
      `;
      return;
    }

    // Gestione unificata per file di testo (sia singolo che multiplo)
    if (textFiles.length >= 1 && chatFiles.length === 0) {
      localStorage.setItem("multiTextFiles", JSON.stringify(textFiles));
      localStorage.setItem("tipoDocumento", "testo-multiplo");

      const lang = localStorage.getItem("lingua") || "it";
      const messaggio =
        textFiles.length === 1
          ? lang === "it"
            ? "È stato selezionato un file di testo generico."
            : "A generic text file has been selected."
          : lang === "it"
          ? `Sono stati selezionati ${textFiles.length} file di testo generico.`
          : `${textFiles.length} generic text files have been selected.`;

      document.getElementById("risultato").innerHTML = `
      <p class="analisi-risultato">${messaggio}</p>
      <button class="btn-avanti" onclick="vaiElaborazioneMultipla()">${
        lang === "it" ? "Avanti" : "Next"
      }</button>
    `;
      return;
    }
  });

  // Reset input file per permettere stesso file due volte
  document.getElementById("fileInput").value = "";
}

function vaiElaborazioneMultipla() {
  const files = JSON.parse(localStorage.getItem("multiTextFiles") || "[]");
  if (!files.length) return;

  // Salva tutti i file in localStorage condiviso
  localStorage.setItem("multiTextFiles", JSON.stringify(files));
  localStorage.setItem("tipoDocumento", "testo-multiplo");

  // Prima finestra → file 0
  window.location.href = "elaborazione.html?file=0";

  // Altre finestre
  for (let i = 1; i < files.length; i++) {
    window.open(`elaborazione.html?file=${i}`, "_blank");
  }
}

function vaiElaborazioneMista() {
  const files = JSON.parse(localStorage.getItem("multiMixedFiles") || "[]");

  if (!files.length) return;

  // Contiamo quanti file di tipo "chat" ci sono
  const regexChat = /\[\d{2}\/\d{2}\/\d{2}, \d{2}:\d{2}:\d{2}\] .+/;
  const totalChatFiles = files.filter((file) =>
    regexChat.test(file.contenuto)
  ).length;

  // Salviamo il numero totale di chat da processare e azzeriamo il contatore
  localStorage.setItem("totalMixedChats", totalChatFiles);
  localStorage.setItem("processedMixedChats", 0);

  // Puliamo i risultati parziali precedenti per sicurezza
  files.forEach((_, i) => localStorage.removeItem(`chatResult_${i}`));

  // Apri la prima analisi qui
  localStorage.setItem("multiMixedFiles", JSON.stringify(files));
  localStorage.setItem("tipoDocumento", "misto");

  localStorage.removeItem("chatContent");
  localStorage.removeItem("chatBackup");
  localStorage.removeItem("textResults");
  localStorage.removeItem("chatLinks");

  window.location.href = "elaborazione.html?file=0";

  // Apri nuove finestre per gli altri
  for (let i = 1; i < files.length; i++) {
    window.open(`elaborazione.html?file=${i}`, "_blank");
  }
}

function aggiornaAreaTesto(files) {
  const area = document.getElementById("manualText");
  if (!area) return; // evita l'errore se non esiste nella pagina

  area.value = files.map((f) => `• ${f.name}`).join("\n");
  localStorage.removeItem("chatContent"); // Non salviamo contenuto ora
}

async function processaSingolaChat(testo, groupName) {
  const flags = (localStorage.getItem("chatFlags") || "").split(" ");
  const usaAPI = flags.includes("-h");
  const mostraContenuto = flags.includes("-c");

  const righe = testo.split("\n");
  const regex =
    /\[(\d{1,2}\/\d{1,2}\/\d{2,4}), (\d{2}:\d{2}:\d{2})\] (.+?): (.+)/;

  const nomiAnonimi = {};
  const listaNomi = [
    "Andrea",
    "Francesco",
    "Marco",
    "Alessandro",
    "Giuseppe",
    "Luca",
    "Maria",
    "Anna",
    "Antonio",
    "Francesca",
    "Giovanni",
    "Paolo",
    "Stefano",
    "Matteo",
    "Roberto",
    "Elena",
    "Davide",
    "Giulia",
    "Sara",
    "Laura",
    "Chiara",
    "Paola",
    "Lorenzo",
    "Daniela",
    "Luigi",
    "Daniele",
    "Riccardo",
    "Simone",
    "Gabriele",
    "Salvatore",
    "Massimo",
    "Silvia",
    "Federico",
    "Alberto",
    "Claudio",
    "Cristina",
    "Fabio",
    "Valentina",
    "Martina",
    "Monica",
    "Federica",
    "Elisa",
    "Vincenzo",
    "Lucia",
    "Giorgio",
    "Franco",
    "Patrizia",
    "Mattia",
    "Giovanna",
    "Angela",
    "Pietro",
    "Mauro",
    "Alessandra",
    "Michele",
    "Barbara",
    "Mario",
    "Giuseppina",
    "Domenico",
    "Maurizio",
    "Stefania",
    "Filippo",
    "Roberta",
    "Simona",
    "Antonella",
    "Alessia",
    "Alice",
    "Claudia",
    "Luciano",
    "Carla",
    "Sofia",
    "Enrico",
    "Leonardo",
    "Carlo",
    "Elisabetta",
    "Giorgia",
    "Angelo",
    "Franca",
    "Fabrizio",
    "Sergio",
    "Nicola",
    "Gianluca",
    "Cristian",
    "Caterina",
    "Rita",
    "Tommaso",
    "Luisa",
    "Anna Maria",
    "Eleonora",
    "Gianni",
    "Emanuele",
    "Silvana",
    "Rosa",
    "Marina",
    "Marta",
    "Ilaria",
    "Giuliano",
    "Beatrice",
    "Marisa",
    "Valeria",
    "Giacomo",
  ];

  let index = 0;

  function anonimizza(nome) {
    if (!nomiAnonimi[nome]) nomiAnonimi[nome] = listaNomi[index++] || nome;
    return nomiAnonimi[nome];
  }

  const partecipanti = new Set();
  const links = [];

  for (let i = 0; i < righe.length; i++) {
    const riga = righe[i];
    const match = riga.match(regex);
    if (!match) continue;

    const [_, data, ora, mittente, messaggio] = match;
    const datetime = parseDataOra(data, ora);
    const anonMittente = anonimizza(mittente.trim());
    partecipanti.add(anonMittente);
    const destinatari = [...partecipanti].filter((p) => p !== anonMittente);

    const tossicita = usaAPI ? await ottieniTossicita(messaggio) : 0;
    const numeroParole = messaggio.trim().split(/\s+/).length;

    for (const destinatario of destinatari) {
      links.push({
        source: anonMittente,
        target: destinatario,
        timeSlot: datetime.toISOString(),
        tossicita,
        message: mostraContenuto ? messaggio : "",
        number_of_words: numeroParole,
        group: groupName,
      });
    }

    // AGGIORNA BARRA DI PROGRESSO (solo per singola chat)
    const barra = document.querySelector(".progress-bar");
    const percentuale = document.getElementById("percentualeTesto");
    const messaggioElaborazione = document.getElementById(
      "messaggioChatAnalizzate"
    );
    const percent = Math.round(((i + 1) / righe.length) * 100);
    if (barra) barra.style.width = `${percent}%`;
    if (percentuale) percentuale.textContent = `${percent}%`;
    if (messaggioElaborazione) {
      const lingua = localStorage.getItem("lingua") || "it";
      const testoTradotto = {
        it: (x, y) => `Analizzati ${x} di ${y} messaggi`,
        en: (x, y) => `Analyzed ${x} of ${y} messages`,
      };
      messaggioElaborazione.textContent = testoTradotto[lingua](
        i + 1,
        righe.length
      );
    }
  }

  return links;
}

async function elaboraTutteLeChat() {
  const barra = document.querySelector(".progress-bar");
  const percentuale = document.getElementById("percentualeTesto");
  const messaggioElaborazione = document.getElementById(
    "messaggioChatAnalizzate"
  );

  const files = JSON.parse(localStorage.getItem("multiChatFiles") || "[]");
  const risultati = [];
  const colori = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
  ];

  const totale = files.length;

  for (let i = 0; i < totale; i++) {
    const { name, contenuto } = files[i];
    const parsed = await processaSingolaChat(contenuto, name);
    const colore = colori[i % colori.length];
    parsed.forEach((d) => (d._color = colore));
    risultati.push(...parsed);

    // Aggiorna barra
    const percent = Math.round(((i + 1) / totale) * 100);
    if (barra) barra.style.width = `${percent}%`;
    if (percentuale) percentuale.textContent = `${percent}%`;

    if (messaggioElaborazione) {
      const lingua = localStorage.getItem("lingua") || "it";
      const testoTradotto = {
        it: (x, y) => `Analizzate ${x} di ${y} chat`,
        en: (x, y) => `Analyzed ${x} of ${y} chats`,
      };
      messaggioElaborazione.textContent = testoTradotto[lingua](i + 1, totale);
    }
  }

  localStorage.setItem("chatLinks", JSON.stringify(risultati));
  window.location.href = "visualizzazione.html";
}

function parseDataOra(data, ora) {
  const [gg, mm, aa] = data.split("/").map(Number);
  const [hh, min, ss] = ora.split(":").map(Number);
  return new Date(2000 + (aa < 100 ? aa : aa - 2000), mm - 1, gg, hh, min, ss);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ottieniTossicita(testo) {
  if (!testo.trim()) return 0;
  const url = "https://api-inference.huggingface.co/models/unitary/toxic-bert";
  const token = "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";

  try {
    await sleep(750); // evita overload
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: testo }),
    });

    const data = await res.json();
    const toxic = data[0]?.find((e) => e.label === "toxic");
    return toxic ? +toxic.score.toFixed(2) : 0;
  } catch (e) {
    console.error("Errore HuggingFace:", e);
    return 0;
  }
}

// Gestisce il file droppato con drag & drop
function gestisciDrop(event) {
  event.preventDefault(); // Previene il comportamento di default del browser (apertura file)
  const file = event.dataTransfer.files[0]; // Prendo il primo file droppato
  if (file) {
    const reader = new FileReader(); // Creo un FileReader

    reader.onload = function (event) {
      const testo = event.target.result;
      analizzaTesto(testo);
    };

    reader.readAsText(file);
  }
}

function analizzaFlagOpzioni() {
  const flags = [];
  if (document.getElementById("chk-api")?.checked) flags.push("-h");
  if (document.getElementById("chk-contenuto")?.checked) flags.push("-c");
  localStorage.setItem("chatFlags", flags.join(" "));
}

// Analizza il testo caricato per capire se è una chat WhatsApp o un testo normale
function analizzaTesto(testo) {
  const regexChat = /\[\d{2}\/\d{2}\/\d{2}, \d{2}:\d{2}:\d{2}\] .+/;
  const risultatoDiv = document.getElementById("risultato");
  const lang = localStorage.getItem("lingua") || "it";

  const testi = {
    it: {
      risultato_testo: "Il documento è un file di testo.",
      risultato_chat: "Il documento è una chat WhatsApp.",
      avanti: "Avanti",
    },
    en: {
      risultato_testo: "The document is a text file.",
      risultato_chat: "The document is a WhatsApp chat.",
      avanti: "Next",
    },
  };

  const t = testi[lang];

  let tipo;
  if (regexChat.test(testo)) {
    tipo = "chat";
    document.getElementById("btn-opzioni").classList.remove("disabled");
    document.getElementById("btn-opzioni").removeAttribute("title");
    risultatoDiv.innerHTML = `
      <p class="analisi-risultato">${t.risultato_chat}</p>
      <button class="btn-avanti" onclick="vaiElaborazione()">${t.avanti}</button>
    `;
  } else {
    tipo = "testo";
    document.getElementById("btn-opzioni").classList.add("disabled");
    document
      .getElementById("btn-opzioni")
      .setAttribute("title", "Disponibile solo per chat WhatsApp");
    risultatoDiv.innerHTML = `
  <p class="analisi-risultato">${t.risultato_testo}</p>
  <button class="btn-avanti" onclick="vaiElaborazione(true)">${t.avanti}</button>
`;
  }

  localStorage.setItem("tipoDocumento", tipo);
  localStorage.setItem("chatContent", testo);
  // Se ci sono più file, salva un flag
  const multiFiles = JSON.parse(localStorage.getItem("multiChatFiles") || "[]");
  if (multiFiles.length > 1) {
    localStorage.setItem("multiChatMode", "true");
  } else {
    localStorage.removeItem("multiChatMode");
  }

  analizzaFlagOpzioni(); // chiamata per aggiornare i flag corretti

  analizzaFlagOpzioni(); // chiamata per aggiornare i flag corretti
}

// Funzione che reindirizza alla pagina di elaborazione
function vaiElaborazione(isText = false) {
  // Se è testo generico, salviamo un flag
  if (isText) {
    localStorage.setItem("isTextRedirect", "true");
  }
  window.location.href = "elaborazione.html";
}

// Codice che si esegue quando il DOM è caricato (pagina pronta)
document.addEventListener("DOMContentLoaded", function () {
  // Se siamo su index.html o root "/"
  if (
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname === "/"
  ) {
    const comparazioneContainer = document.getElementById(
      "comparazione-container"
    );
    if (comparazioneContainer) {
      comparazioneContainer.classList.add("hidden"); // Nascondo il container comparazione
    }
    // Lista di selettori da mostrare
    const elementiDaMostrare = [
      "h1",
      ".breadcrumb",
      "p",
      "#grafico-container",
      ".grafico-buttons",
    ];
    // Per ogni selettore mostro l'elemento (display di default)
    elementiDaMostrare.forEach((selector) => {
      const el = document.querySelector(selector);
      if (el) el.style.display = "";
    });
  }

  // Solo su visualizzazione.html

  if (window.location.pathname.includes("visualizzazione.html")) {
    const btnNuovaAnalisi = document.querySelector(".btn-nuova-analisi");
    if (btnNuovaAnalisi) {
      btnNuovaAnalisi.addEventListener("click", () => {
        // Reindirizza alla home per nuova analisi
        window.location.href = "index.html";
      });
    }
  }

  // Gestione click sui link breadcrumb per marcare come completati
  const breadcrumbLinks = document.querySelectorAll(".breadcrumb a");

  breadcrumbLinks.forEach((link, index) => {
    link.addEventListener("click", function () {
      breadcrumbLinks.forEach((step, stepIndex) => {
        if (stepIndex <= index) {
          step.classList.add("completed"); // Passi fino a questo diventano "completed"
        } else {
          step.classList.remove("completed"); // I successivi no
        }
      });
    });

    // Evidenzio il link corrente in base all'URL
    if (
      link.href === window.location.href ||
      window.location.pathname.endsWith(link.getAttribute("href"))
    ) {
      link.classList.add("current");
    }
  });

  const preCaricati = JSON.parse(
    localStorage.getItem("multiChatFiles") || "[]"
  );
  if (preCaricati.length) aggiornaAreaTesto(preCaricati);

  // Gestione animazione barra di caricamento (se presente)
  const barra = document.querySelector(".progress-bar");
  if (barra) {
    barra.addEventListener("animationend", function () {
      window.location.href = "visualizzazione.html"; // Al termine animazione vado alla pagina visualizzazione
    });
  }
});

// Tema chiaro/scuro: applicazione e salvataggio
document.addEventListener("DOMContentLoaded", () => {
  const temaSalvato = localStorage.getItem("tema") || "chiaro";
  document.body.classList.toggle("dark-theme", temaSalvato === "scuro");
});
