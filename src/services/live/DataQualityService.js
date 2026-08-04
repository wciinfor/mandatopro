/**
 * DataQualityService
 * Camada desacoplada responsável por avaliar a qualidade, consistência, latência e integridade dos dados do LiveSnapshot.
 */
export const DataQualityService = {
  avaliarSnapshot(snapshotData, tempoGeracaoMs) {
    const warnings = [];
    const errors = [];

    // 1. Freshness (Idade do Snapshot)
    const idadeMs = Date.now() - new Date(snapshotData.metadata?.ultimaAtualizacao || Date.now()).getTime();
    const isFresh = idadeMs <= 30000;
    if (!isFresh) {
      warnings.push(`Snapshot desatualizado (idade: ${Math.round(idadeMs / 1000)}s)`);
    }

    // 2. Performance (Latência de geração)
    const isPerformanceOk = tempoGeracaoMs < 1500;
    if (!isPerformanceOk) {
      warnings.push(`Tempo de geração do snapshot acima do ideal (${tempoGeracaoMs}ms)`);
    }

    // 3. Consistency (Consistência entre Agregações)
    const totalEleitores = snapshotData.kpisExecutivos?.totalEleitores || 0;
    const cadastrosHoje = snapshotData.kpisExecutivos?.cadastrosHoje || 0;
    const isConsistencyOk = cadastrosHoje <= totalEleitores;

    if (!isConsistencyOk) {
      errors.push('Inconsistência detectada: cadastros de hoje superiores ao total de eleitores');
    }

    // 4. Coverage (Cobertura Territorial)
    const municipiosComPresenca = snapshotData.coberturaTerritorial?.municipiosComPresenca || 0;
    const totalMunicipiosPA = snapshotData.kpisExecutivos?.totalMunicipiosEstado || 144;
    const coberturaPercent = Math.round((municipiosComPresenca / totalMunicipiosPA) * 100);

    // 5. Cálculo do Health Score (0-100)
    let healthScore = 100;
    if (errors.length > 0) healthScore -= (errors.length * 30);
    if (warnings.length > 0) healthScore -= (warnings.length * 10);
    healthScore = Math.max(0, Math.min(100, healthScore));

    let status = 'HEALTHY';
    if (healthScore < 60) status = 'CRITICAL';
    else if (healthScore < 85) status = 'WARNING';

    return {
      healthScore,
      status,
      warnings,
      errors,
      performance: {
        tempoGeracaoMs,
        isPerformanceOk
      },
      coverage: {
        municipiosComPresenca,
        totalMunicipiosPA,
        coberturaPercent
      },
      consistency: {
        isConsistencyOk,
        totalEleitores,
        cadastrosHoje
      },
      freshness: {
        idadeMs,
        isFresh
      }
    };
  }
};
