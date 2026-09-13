import React, { useState, useEffect, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

const CLIENT_ID = "566109407372-csgpmbhajsghbfv84aldku66pfisuqe3.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const FILE_NAME = "mi-pizarra-excalidraw.json";
const LOCAL_STORAGE_KEY = "mi-pizarra-local-cache";

// Función para limpiar datos corruptos y evitar el error de collaborators
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

  const sceneRef = useRef({ elements: [], appState: {}, files: {} });

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

    setStatus("Guardando en Drive...");
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
        const createData = await createRes.json();
        fileId = createData.id;
      }

      if (!fileId) {
        throw new Error("No se pudo crear el archivo en Drive");
      }

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
        setStatus("¡Guardado con éxito!");
        setTimeout(() => setStatus("Conectado a Google"), 3000);
      } else {
        setStatus("Error al subir a Drive");
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

  return (
    <div style={{ width: "100vw", height: "100vh", position: "fixed", inset: 0 }}>
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
        onChange={(elements, appState, files) => {
          sceneRef.current = { elements, appState, files };
        }}
      />
    </div>
  );
}