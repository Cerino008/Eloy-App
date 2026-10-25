-- v2.1 · Repetición del aviso mientras nadie atiende una alerta.
-- Para bases que YA se crearon con la v2.0. Las bases nuevas ya lo traen en eloy_servidor.sql.
-- Se corre una sola vez, sobre la base de Eloy:  mysql -u usuario -p eloy < sql/cambios/001_reaviso_alertas.sql
ALTER TABLE alertas_sos
  ADD COLUMN proximo_reaviso_en DATETIME         NULL                 AFTER nota_cierre,
  ADD COLUMN avisos_repetidos   TINYINT UNSIGNED NOT NULL DEFAULT 0   AFTER proximo_reaviso_en,
  ADD KEY ix_alertas_reaviso (estado, proximo_reaviso_en);
