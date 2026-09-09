// =========================================================================
// VAAREC 3D CANOE TRANSFORMATION CONFIGURATION & CALIBRATION MATRIX
// Este arquivo armazena os parâmetros de calibração para o modelo 3D canoe_3D.glb
// Calibrado no Laboratório de Modelos 3D (model-test.html)
// =========================================================================

export const CANOE_3D_CONFIG = {
  modelPath: '/Model/canoe_3D.glb',
  positionOffset: {
    x: 0.0,
    y: 0.0,
    z: 0.10
  },
  rotationOffsetDeg: {
    x: 0.0,
    y: 0.0,
    z: 0.0,
    order: 'ZYX'
  },
  scale: {
    uniform: true,
    scaleU: 1.0,
    x: 1.0,
    y: 1.0,
    z: 1.0
  },
  elevationZAboveWater: 0.10
};

/**
 * Aplica a calibração de matriz de transformação ao grupo Three.js da canoa
 * @param {THREE.Object3D} boatGroup - Grupo raiz Three.js contendo a canoa
 * @param {Object} [customConfig] - Configuração customizada opcional
 */
export function applyCanoeCalibration(boatGroup, customConfig = CANOE_3D_CONFIG) {
  if (!boatGroup) return;

  const cfg = customConfig;

  // 1. Posição / Offset relativo
  boatGroup.position.set(
    cfg.positionOffset.x || 0,
    cfg.positionOffset.y || 0,
    cfg.positionOffset.z || 0
  );

  // 2. Rotação Euler
  boatGroup.rotation.order = cfg.rotationOffsetDeg.order || 'ZYX';
  boatGroup.rotation.set(
    ((cfg.rotationOffsetDeg.x || 0) * Math.PI) / 180,
    ((cfg.rotationOffsetDeg.y || 0) * Math.PI) / 180,
    ((cfg.rotationOffsetDeg.z || 0) * Math.PI) / 180
  );

  // 3. Escala
  if (cfg.scale.uniform) {
    boatGroup.scale.setScalar(cfg.scale.scaleU || 1.0);
  } else {
    boatGroup.scale.set(
      cfg.scale.x || 1.0,
      cfg.scale.y || 1.0,
      cfg.scale.z || 1.0
    );
  }
}

// Suporte para navegadores e scripts normais sem ES Modules
if (typeof window !== 'undefined') {
  window.CANOE_3D_CONFIG = CANOE_3D_CONFIG;
  window.applyCanoeCalibration = applyCanoeCalibration;
}
