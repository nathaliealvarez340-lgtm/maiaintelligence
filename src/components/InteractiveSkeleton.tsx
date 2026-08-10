"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";

type ViewKey = "front" | "back";

type SkeletonZone = {
  id: string;
  label: string;
  title: string;
  text: string;
  x: string;
  y: string;
};

type SkeletonView = {
  label: string;
  image: string;
  zones: SkeletonZone[];
};

const skeletonData: Record<ViewKey, SkeletonView> = {
  front: {
    label: "Frontal",
    image: "/images/esqueleto-frontal.png",
    zones: [
      {
        id: "shoulder",
        label: "Hombro",
        title: "Prótesis de hombro",
        text: "Soluciones internas orientadas a recuperar estabilidad, movilidad y soporte articular en procedimientos especializados.",
        x: "47%",
        y: "23%",
      },
      {
        id: "spine",
        label: "Columna",
        title: "Soluciones para columna",
        text: "Sistemas internos diseñados para soporte, alineación y estabilización en intervenciones de alta precisión.",
        x: "50%",
        y: "38%",
      },
      {
        id: "hip",
        label: "Cadera",
        title: "Prótesis de cadera",
        text: "Implantes internos enfocados en restaurar movilidad, función articular y calidad de vida del paciente.",
        x: "50%",
        y: "54%",
      },
      {
        id: "knee",
        label: "Rodilla",
        title: "Prótesis de rodilla",
        text: "Soluciones para reemplazo articular orientadas a estabilidad, resistencia y recuperación funcional.",
        x: "50%",
        y: "72%",
      },
      {
        id: "trauma",
        label: "Trauma y fijación",
        title: "Trauma y fijación",
        text: "Dispositivos internos para estabilización ósea, soporte estructural y recuperación en casos traumatológicos.",
        x: "39%",
        y: "47%",
      },
    ],
  },
  back: {
    label: "Posterior",
    image: "/images/esqueleto-reverso.png",
    zones: [
      {
        id: "posterior-spine",
        label: "Columna posterior",
        title: "Columna posterior",
        text: "Soluciones orientadas a estabilización, soporte estructural y alineación en procedimientos de columna.",
        x: "50%",
        y: "35%",
      },
      {
        id: "posterior-shoulder",
        label: "Hombro posterior",
        title: "Hombro posterior",
        text: "Sistemas internos diseñados para soporte articular y recuperación funcional en procedimientos especializados.",
        x: "53%",
        y: "24%",
      },
      {
        id: "posterior-hip",
        label: "Cadera posterior",
        title: "Cadera posterior",
        text: "Implantes internos enfocados en movilidad, estabilidad y soporte desde el abordaje posterior.",
        x: "50%",
        y: "55%",
      },
      {
        id: "posterior-knee",
        label: "Rodilla posterior",
        title: "Rodilla posterior",
        text: "Soluciones para articulación de rodilla orientadas a estabilidad, resistencia y recuperación del movimiento.",
        x: "50%",
        y: "73%",
      },
      {
        id: "posterior-limbs",
        label: "Extremidades",
        title: "Extremidades",
        text: "Dispositivos internos para soporte, fijación y recuperación estructural en extremidades superiores e inferiores.",
        x: "61%",
        y: "48%",
      },
    ],
  },
};

function getInitialZone(view: ViewKey) {
  return view === "front" ? "knee" : "posterior-spine";
}

export default function InteractiveSkeleton() {
  const [activeView, setActiveView] = useState<ViewKey>("front");
  const [activeZone, setActiveZone] = useState(getInitialZone("front"));

  const currentView = skeletonData[activeView];
  const selectedZone = useMemo(() => {
    return (
      currentView.zones.find((zone) => zone.id === activeZone) ??
      currentView.zones[0]
    );
  }, [activeZone, currentView.zones]);

  function handleViewChange(nextView: ViewKey) {
    setActiveView(nextView);
    setActiveZone((currentZone) => {
      const nextZones = skeletonData[nextView].zones;
      const zoneExists = nextZones.some((zone) => zone.id === currentZone);

      return zoneExists ? currentZone : getInitialZone(nextView);
    });
  }

  return (
    <section className="interactive-skeleton-section" aria-labelledby="anatomy-title">
      <div className="interactive-skeleton-shell">
        <div className="interactive-skeleton-copy">
          <p className="interactive-skeleton-eyebrow">Áreas anatómicas</p>
          <h2 id="anatomy-title">Soluciones internas por especialidad</h2>
          <p className="interactive-skeleton-intro">
            Explora las principales áreas donde BET integra tecnología médica,
            precisión y soporte especializado para procedimientos ortopédicos.
          </p>

          <div
            className="interactive-skeleton-toggle"
            aria-label="Seleccionar vista anatómica"
          >
            {(Object.keys(skeletonData) as ViewKey[]).map((viewKey) => (
              <button
                aria-pressed={activeView === viewKey}
                className={activeView === viewKey ? "is-active" : ""}
                key={viewKey}
                onClick={() => handleViewChange(viewKey)}
                type="button"
              >
                {skeletonData[viewKey].label}
              </button>
            ))}
          </div>

          <article className="interactive-skeleton-card" aria-live="polite">
            <span>{selectedZone.label}</span>
            <h3>{selectedZone.title}</h3>
            <p>{selectedZone.text}</p>
          </article>
        </div>

        <div className="interactive-skeleton-visual">
          <div className="interactive-skeleton-frame">
            <div className="interactive-skeleton-stage" key={activeView}>
              <Image
                alt={`Esqueleto vista ${currentView.label.toLowerCase()}`}
                className="interactive-skeleton-image"
                fill
                priority
                sizes="(max-width: 900px) 88vw, 44vw"
                src={currentView.image}
              />

              {currentView.zones.map((zone) => (
                <button
                  aria-label={`Seleccionar ${zone.label}`}
                  aria-pressed={selectedZone.id === zone.id}
                  className={`interactive-skeleton-hotspot${
                    selectedZone.id === zone.id ? " is-active" : ""
                  }`}
                  key={zone.id}
                  onClick={() => setActiveZone(zone.id)}
                  style={
                    {
                      "--hotspot-x": zone.x,
                      "--hotspot-y": zone.y,
                    } as CSSProperties
                  }
                  type="button"
                >
                  <span className="sr-only">{zone.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
