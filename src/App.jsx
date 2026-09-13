import React, { useState, useEffect } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

// Tu ID de Cliente de Google Cloud
const CLIENT_ID = "566109407372-csgpmbhajsghbfv84aldku66pfisuqe3.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const FILE_NAME = "mi-pizarra-excalidraw.json";

export default function App() {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [status, setStatus] = useState("Listo");
  const [tokenClient, setTokenClient] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  // Cargar el script de autenticación de Google de forma automática
  useEffect(() => {
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
    }
  };

  // Buscar si el archivo de la pizarra ya existe en el Google Drive del usuario
  const findFileId = async (token) => {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and trashed=false`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  };

  // Función para GUARDAR en Google Drive
  const saveToDrive = async () => {
    if (!accessToken) {
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

      const fileId = await findFileId(accessToken);

      if (fileId) {
        // Si ya existe, lo actualiza
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: content,
          }
        );
      } else {
        // Si no existe, crea un archivo nuevo
        const metadata = {
          name: FILE_NAME,
          mimeType: "application/json",
        };

        const form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
        form.append("file", new Blob([content], { type: "application/json" }));

        await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
          }
        );
      }
      setStatus("¡Guardado en Drive con éxito!");
      setTimeout(() => setStatus("Conectado a Google"), 3000);
    } catch (error) {
      console.error(error);
      setStatus("Error al guardar");
    }
  };

  // Función para CARGAR desde Google Drive
  const loadFromDrive = async () => {
    if (!accessToken) {
      setStatus("Inicia sesión primero");
      handleAuthClick();
      return;
    }
    if (!excalidrawAPI) return;

    setStatus("Cargando de Drive...");
    try {
      const fileId = await findFileId(accessToken);
      if (!fileId) {
        setStatus("No hay archivo guardado aún.");
        setTimeout(() => setStatus("Conectado a Google"), 3000);
        return;
      }

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
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

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", inset: 0 }}>
      {/* Panel flotante superior derecho para conectar y sincronizar */}
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

      <Excalidraw ref={(api) => setExcalidrawAPI(api)} />
    </div>
  );
}