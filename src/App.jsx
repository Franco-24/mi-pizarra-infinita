import React, { useState, useEffect, useRef, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

const CLIENT_ID = "566109407372-csgpmbhajsghbfv84aldku66pfisuqe3.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const FILE_NAME = "mi-pizarra-excalidraw.json";
const LOCAL_STORAGE_KEY = "mi-pizarra-local-cache";

const sanitizeData = (data) => {
  if (!data) return null;
  if (data.appState) {
    delete data.appState.collaborators;
  }
  return data;
};

export default function App() {
  const [status, setStatus] = useState("Listo");
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [videos, setVideos] = useState([]);
  const [showVideoModal, setShowVideoModal] = useState(false);
  
  const fileInputRef = useRef(null);
  const sceneRef = useRef({ elements: [], appState: {}, files: {} });
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);

  const handleAuthError = (res) => {
    if (res.status === 401) {
      localStorage.removeItem("g_access_token");
      setAccessToken(null);
      setStatus("Sesión expirada. Inicia sesión de nuevo.");
      return true;
    }
    return false;
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("g_access_token");
    if (savedToken) {
      setAccessToken(savedToken);
      setStatus("Conectado a Google");
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            localStorage.setItem("g_access_token", response.access_token);
            setStatus("Conectado a Google");
          }
        },
      });
      setTokenClient(client);
    };
    document.body.appendChild(script);
  }, []);

  const handleAuthClick = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    } else {
      setStatus("Cargando Google...");
    }
  };

  const findFileId = async (token) => {
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and trashed=false`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (handleAuthError(res)) return null;
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const saveToDrive = async () => {
    const token = accessToken || localStorage.getItem("g_access_token");
    if (!token) {
      setStatus("Inicia sesión primero");
      handleAuthClick();
      return;
    }

    setStatus("Guardando pizarra...");
    try {
      const { elements, appState, files } = sceneRef.current;
      const cleanAppState = { ...appState };
      delete cleanAppState.collaborators;

      const content = JSON.stringify({ elements, appState: cleanAppState, files });
      localStorage.setItem(LOCAL_STORAGE_KEY, content);

      let fileId = await findFileId(token);

      if (!fileId) {
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: FILE_NAME,
            mimeType: "application/json",
          }),
        });
        if (handleAuthError(createRes)) return;
        const createData = await createRes.json();
        fileId = createData.id;
      }

      if (!fileId) throw new Error("No se pudo crear el archivo");

      const uploadRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: content,
        }
      );

      if (handleAuthError(uploadRes)) return;

      if (uploadRes.ok) {
        setStatus("¡Pizarra guardada!");
        setTimeout(() => setStatus("Conectado a Google"), 3000);
      } else {
        setStatus("Error al guardar pizarra");
      }
    } catch (error) {
      console.error(error);
      setStatus("Error al guardar");
    }
  };

  const loadFromDrive = async () => {
    const token = accessToken || localStorage.getItem("g_access_token");
    if (!token) {
      setStatus("Inicia sesión primero");
      handleAuthClick();
      return;
    }

    setStatus("Cargando pizarra...");
    try {
      const fileId = await findFileId(token);
      if (!fileId) {
        setStatus("No hay pizarra en Drive.");
        setTimeout(() => setStatus("Conectado a Google"), 3000);
        return;
      }

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (handleAuthError(res)) return;
      const data = await res.json();

      if (data && data.elements) {
        const cleanData = sanitizeData(data);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanData));
        setStatus("¡Cargado! Actualizando...");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setStatus("El archivo está vacío");
      }
    } catch (error) {
      console.error(error);
      setStatus("Error al cargar");
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const token = accessToken || localStorage.getItem("g_access_token");
    if (!token) {
      setStatus("Inicia sesión primero");
      handleAuthClick();
      return;
    }

    setStatus(`Subiendo video...`);
    try {
      const metadata = { name: file.name, mimeType: file.type };
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", file);

      const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        }
      );

      if (handleAuthError(res)) return;

      if (res.ok) {
        setStatus("¡Video subido a Drive!");
        setTimeout(() => setStatus("Conectado a Google"), 3000);
        fetchVideos();
      } else {
        setStatus("Error al subir video");
      }
    } catch (error) {
      console.error(error);
      setStatus("Error en subida");
    }
    e.target.value = "";
  };

  const fetchVideos = async () => {
    const token = accessToken || localStorage.getItem("g_access_token");
    if (!token) return;

    try {
      const res = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType contains 'video/' and trashed=false&fields=files(id, name)",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (handleAuthError(res)) return;
      const data = await res.json();
      if (data.files) {
        setVideos(data.files);
      }
    } catch (e) {
      console.error("Error al obtener videos", e);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchVideos();
    }
  }, [accessToken]);

  const handleSceneChange = useCallback((elements, appState, files) => {
    sceneRef.current = { elements, appState, files };
    
    const timeoutId = setTimeout(() => {
      try {
        const cleanAppState = { ...appState };
        delete cleanAppState.collaborators;
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({ elements, appState: cleanAppState, files })
        );
      } catch (err) {
        console.error("Error en autoguardado local:", err);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  const insertVideoToCanvas = (vid) => {
    if (!excalidrawAPI) {
      console.error("La API de Excalidraw no está conectada.");
      return;
    }

    const appState = excalidrawAPI.getAppState();
    const currentElements = excalidrawAPI.getSceneElements();

    // Cálculo mejorado considerando el nivel de Zoom actual del usuario
    const zoomValue = appState.zoom?.value || 1;
    const x = (window.innerWidth / 2 - appState.scrollX) / zoomValue - 280;
    const y = (window.innerHeight / 2 - appState.scrollY) / zoomValue - 160;

    const videoElement = {
      type: "iframe",
      id: `video_${vid.id}_${Date.now()}`,
      x: x,
      y: y,
      width: 560,
      height: 315,
      angle: 0,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 100000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: `https://drive.google.com/file/d/${vid.id}/preview`,
      locked: false,
    };

    excalidrawAPI.updateScene({
      elements: [...currentElements, videoElement],
    });

    setShowVideoModal(false);
    setStatus("¡Video insertado en el lienzo!");
    setTimeout(() => setStatus("Conectado a Google"), 3000);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", inset: 0 }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleVideoUpload}
        accept="video/*"
        style={{ display: "none" }}
      />

      {/* Menú reubicado a la parte inferior central para no estorbar a Excalidraw */}
      <div
        style={{
          position: "absolute",
          bottom: 30, // Movido abajo
          left: "50%", // Centrado horizontalmente
          transform: "translateX(-50%)", // Ajuste para centrar perfecto
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "white",
          padding: "8px 14px",
          borderRadius: "10px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <span style={{ fontSize: "13px", color: "#444", fontWeight: "600" }}>
          {status}
        </span>

        {!accessToken ? (
          <button
            onClick={handleAuthClick}
            style={{ background: "#4285F4", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
          >
            Iniciar sesión Google
          </button>
        ) : (
          <>
            <button
              onClick={saveToDrive}
              style={{ background: "#34A853", color: "white", border: "none", padding: "8px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
            >
              Guardar Pizarra
            </button>
            <button
              onClick={loadFromDrive}
              style={{ background: "#FBBC05", color: "black", border: "none", padding: "8px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
            >
              Cargar Pizarra
            </button>
            <button
              onClick={() => fileInputRef.current.click()}
              style={{ background: "#EA4335", color: "white", border: "none", padding: "8px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
            >
              Subir Video
            </button>
            <button
              onClick={() => { setShowVideoModal(true); fetchVideos(); }}
              style={{ background: "#9C27B0", color: "white", border: "none", padding: "8px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
            >
              Ver Videos ({videos.length})
            </button>
          </>
        )}
      </div>

      {showVideoModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "white", width: "90%", maxWidth: "550px", maxHeight: "80vh", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", boxShadow: "0 10px 25px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#333" }}>Inserta un video flotante en tu lienzo</h2>
              <button 
                onClick={() => setShowVideoModal(false)}
                style={{ background: "#ddd", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
              >
                Cerrar ✕
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
              {videos.length === 0 ? (
                <p style={{ textAlign: "center", color: "#777", padding: "20px" }}>No hay videos subidos aún.</p>
              ) : (
                videos.map((vid) => (
                  <div key={vid.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #ddd", borderRadius: "8px", padding: "12px", background: "#f9f9f9" }}>
                    <span style={{ fontWeight: "bold", fontSize: "14px", color: "#444", wordBreak: "break-all", maxWidth: "70%" }}>{vid.name}</span>
                    <button
                      onClick={() => insertVideoToCanvas(vid)}
                      style={{ background: "#9C27B0", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
                    >
                      Insertar 📌
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <Excalidraw
        /* ¡CORRECCIÓN CRÍTICA AQUÍ! excalidrawAPI en vez de ref */
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={() => {
          try {
            const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (localData) {
              const parsed = JSON.parse(localData);
              return sanitizeData(parsed);
            }
          } catch (e) {
            return null;
          }
          return null;
        }}
        onChange={handleSceneChange}
        validateEmbeddable={() => true}
      />
    </div>
  );
}