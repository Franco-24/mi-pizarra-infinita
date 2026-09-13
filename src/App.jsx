import React, { useState, useEffect } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

const CLIENT_ID = "566109407372-csgpmbhajsghbfv84aldku66pfisuqe3.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const FILE_NAME = "mi-pizarra-excalidraw.json";
const LOCAL_STORAGE_KEY = "mi-pizarra-local-cache";

export default function App() {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [status, setStatus] = useState("Listo");
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  // Cargar sesión guardada y script de Google al iniciar
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

  // Buscar ID del archivo en Google Drive
  const findFileId = async (token) => {
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and trashed=false`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    } catch (e) {
      console.error("Error buscando archivo", e);
    }
    return null;
  };

  // Función para GUARDAR en Google Drive (Sistema robusto de 2 pasos)
  const saveToDrive = async () => {
    const token = accessToken || localStorage.getItem("g_access_token");
    if (!token) {
      setStatus("Inicia sesión primero");
      handleAuthClick();
      return;
    }
    if (!excalidrawAPI) return;

    setStatus("Guardando en Drive...");
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      const content = JSON.stringify({ elements, appState, files });

      // También guardamos localmente como respaldo inmediato
      localStorage.setItem(LOCAL_STORAGE_KEY, content);

      // Paso 1: Buscar si el archivo ya existe
      let fileId = await findFileId(token);

      // Paso 2: Si no existe, crearlo primero vacío
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
        const createData = await createRes.json();
        fileId = createData.id;
      }

      if (!fileId) {
        throw new Error("No se pudo crear el archivo en Drive");
      }

      // Paso 3: Subir el contenido real al archivo obtenido
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

      if (uploadRes.ok) {
        setStatus("¡Guardado en Drive con éxito!");
        setTimeout(() => setStatus("Conectado a Google"), 3000);
      } else {
        setStatus("Error al subir a Drive");
      }
    } catch (error) {
      console.error(error);
      setStatus("Error al guardar");
    }
  };

  // Función para CARGAR desde Google Drive
  const loadFromDrive = async () => {
    const token = accessToken || localStorage.getItem("g_access_token");
    if (!token) {
      setStatus("Inicia sesión primero");
      handleAuthClick();
      return;
    }
    if (!excalidrawAPI) return;

    setStatus("Cargando de Drive...");
    try {
      const fileId = await findFileId(token);
      if (!fileId) {
        setStatus("No hay archivo en Drive.");
        setTimeout(() => setStatus("Conectado a Google"), 3000);
        return;
      }

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();

      if (data && data.elements) {
        excalidrawAPI.updateScene({
          elements: data.elements,
          appState: data.appState || {},
          files: data.files || {},
        });
        setStatus("¡Cargado desde Drive!");
        setTimeout(() => setStatus("Conectado a Google"), 3000);
      }
    } catch (error) {
      console.error(error);
      setStatus("Error al cargar");
    }
  };

  // Cargar respaldo local inicial si existe al abrir la app
  const getInitialData = () => {
    try {
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localData) {
        return JSON.parse(localData);
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", inset: 0 }}>
      {/* Panel flotante superior derecho */}
      <div
        style={{
          position: "absolute",
          top: 15,
          right: 20,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "10px",
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
            style={{
              background: "#4285F4",
              color: "white",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Iniciar sesión Google
          </button>
        ) : (
          <>
            <button
              onClick={saveToDrive}
              style={{
                background: "#34A853",
                color: "white",
                border: "none",
                padding: "8px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Guardar
            </button>
            <button
              onClick={loadFromDrive}
              style={{
                background: "#FBBC05",
                color: "black",
                border: "none",
                padding: "8px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Cargar
            </button>
          </>
        )}
      </div>

      <Excalidraw
        initialData={getInitialData()}
        ref={(api) => setExcalidrawAPI(api)}
      />
    </div>
  );
}