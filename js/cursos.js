/* Localquest — lista de cursos de graduação para autocompletar (digite as primeiras letras). */
(function () {
  window.Q = window.Q || {};
  Q.CURSOS = [
    'Administração', 'Agronomia', 'Arquitetura e Urbanismo', 'Artes Visuais', 'Biblioteconomia', 'Biomedicina', 'Ciência da Computação',
    'Ciências Biológicas', 'Ciências Contábeis', 'Ciências Econômicas', 'Ciências Sociais', 'Comunicação Social', 'Direito', 'Design',
    'Educação Física', 'Enfermagem', 'Engenharia Ambiental', 'Engenharia Civil', 'Engenharia da Computação', 'Engenharia de Alimentos',
    'Engenharia de Produção', 'Engenharia Elétrica', 'Engenharia Mecânica', 'Engenharia Química', 'Estética e Cosmética', 'Farmácia',
    'Filosofia', 'Física', 'Fisioterapia', 'Fonoaudiologia', 'Geografia', 'Gerontologia', 'Gestão Hospitalar', 'História', 'Jornalismo',
    'Letras', 'Matemática', 'Medicina', 'Medicina Veterinária', 'Nutrição', 'Odontologia', 'Pedagogia', 'Psicologia', 'Publicidade e Propaganda',
    'Química', 'Radiologia', 'Relações Internacionais', 'Serviço Social', 'Sistemas de Informação', 'Terapia Ocupacional', 'Tecnologia em Radiologia',
    'Técnico em Enfermagem', 'Técnico em Radiologia', 'Zootecnia', 'Análise e Desenvolvimento de Sistemas', 'Ciência de Dados', 'Biotecnologia',
    'Educação Especial', 'Engenharia de Software', 'Engenharia Biomédica', 'Saúde Coletiva', 'Segurança do Trabalho', 'Podologia', 'Quiropraxia'
  ];
  /** "6", "6o", "6º", "6º período" → "6º período". Outros textos ficam como foram digitados. */
  Q.normPeriodo = (s) => {
    const m = String(s || '').trim().match(/^(\d{1,2})\s*(?:º|°|ª|o|a)?\s*(?:per[ií]odo|semestre|sem\.?)?$/i);
    return m ? `${+m[1]}º período` : String(s || '').trim();
  };
})();
