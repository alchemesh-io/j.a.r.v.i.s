# 📝 notes

avr. 15, 2026

## **\[WT\] Patient knowledge context \- Weekly**

Invité [Xavier Villelégier](mailto:xavier.villelegier@doctolib.com) [Madiha Latafi](mailto:madiha.latafi@doctolib.com) [Alexandre Guitton](mailto:alexandre.guitton@doctolib.com) [Julien Guitton](mailto:julien.guitton@doctolib.com) [Louis Lin](mailto:louis.lin@doctolib.com) [Mahmoud Bhaya](mailto:mahmoud.bhaya@doctolib.com) [Martin Boutges](mailto:martin.boutges@doctolib.com)

Pièces jointes [\[WT\] Patient knowledge context - Weekly](https://calendar.google.com/calendar/event?eid=MWdlam8xNmFvYWRycjA0dG9yZ3ZkM25vaWtfMjAyNjA0MTZUMTUwMDAwWiBtYWRpaGEubGF0YWZpQGRvY3RvbGliLmNvbQ)

### Résumé

Discussion focused upon Q2 objectives for utilizing PACK in production batch processing via established roadmap and data modeling coordination.

**Objectif T2 et feuille de route**  
L'objectif pour le trimestre 2 est d'avoir au moins 1 cas d'utilisation client en production via un traitement par lots utilisant PACK. L'équipe doit définir une feuille de route avec des jalons pour identifier les besoins en ressources et les goulots d'étranglement pour la collecte des données.

**Coordination de la modélisation des données**  
Une collaboration avec l'équipe MDP dirigée par Pierre Fit est essentielle pour la modélisation des données de santé afin d'éviter la duplication des efforts. Il est crucial d'aligner l'architecture et la modélisation des données d'identité de base pour assurer la consommation des données en amont.

**Priorisation des cas d'utilisation pour POC**  
2 cas d'utilisation prioritaires ont été identifiés pour le trimestre : Notification Journey, suivi de Health Reminder, pour valider la récupération du contexte patient. L'équipe avancera sur le POC de Notification Journey en premier, afin de tester les environnements d'exécution (GCP et AWS) et de s'assurer de la récupération d'un contexte léger en production.

### Étapes suivantes

- [ ] \[Madiha Latafi\] Ajouter Xavier: Ajouter Xavier Villelégier au fil de discussion technique.

- [ ] \[Quelqu'un dans Molaire (.Nantes, 4)\] Préparer Données: Mettre les données de staging sur les tables nécessaires. Préparer les données pour commencer les tests.

- [ ] \[Alexandre Guitton\] Définir Critères: Établir la liste des critères d'acceptation. Compléter cette tâche avant la validation du POC.

- [ ] \[Alexandre Guitton\] Architecture Tables: Réfléchir à la structure des tables. Déterminer la modélisation pour la segmentation (Health Reminder).

- [ ] \[Xavier Villelégier\] Envoyer Tables: Transmettre le premier lot des tables requises. Inclure les données pour Journey et Health Reminder.

- [ ] \[Quelqu'un dans Molaire (.Nantes, 4)\] Configurer Données: Configurer l'exposition des données déchiffrées. Simuler la manière dont MDP exposerait les informations pour l'environnement de staging.

- [ ] \[Madiha Latafi\] Planifier Point: Planifier la réunion de suivi. Mettre l'accent sur le sujet de l'archivage des données.

### Détails

* **Statut de Claude et arrivées tardives**: Mahmoud Bhaya a noté que le système Claude était en panne, affichant des performances dégradées, ce qu'ils ont comparé à un arrêt maladie. Madiha Latafi a salué l'arrivée de Xavier Villelégier et d'autres, et la discussion a noté que quelqu'un dans Molaire (.Nantes, 4\) et leur frère avaient déjà travaillé ensemble chez Orange.

* **Objectif du deuxième trimestre (Q2) et utilisation de PACK**: Madiha Latafi a rappelé que l'objectif de Q2 est d'avoir au moins un cas d'utilisation (use case) utilisant PACK pour cibler des utilisateurs en production via un traitement par lots (batch). L'équipe doit définir les cas à aborder, les points de données nécessaires, et la feuille de route de production.

* **Importance de la feuille de route et des jalons (milestones)**: Madiha Latafi a souligné qu'une feuille de route et des jalons sont essentiels pour une initiative où les membres de l'équipe travaillent sur différents sujets non essentiels, afin d'identifier les besoins en ressources et les blocages. Cela permettra de s'assurer que les données nécessaires sont collectées et correctement modélisées pour les cas d'utilisation, que ce soit des données de santé (H data) ou non.

* **Collaboration sur la modélisation des données de santé (Health Data)**: Madiha Latafi a indiqué qu'elle avait discuté avec Pierre Fit, le responsable de la Plateforme de Données Ma Santé (MDP), qui travaille sur la modélisation des données de santé. Il a été proposé que l'équipe collabore avec eux pour reprendre leur modélisation et leur transmettre leurs demandes ou besoins, afin d'éviter de modéliser les données deux fois.

* **Clarification du périmètre de Digital Twin**: Madiha Latafi a mentionné une initiative parallèle de Stan appelée "Digital Twin" et a cherché à comprendre son périmètre, notant que Pierre Fit, Jérémie et lui Divine gèrent l'équipe MDP. L'objectif principal de Digital Twin semble être de créer les bons canaux de communication entre les dossiers patients (IHR et PHR), entre les différentes vues des patients, et de modéliser ces données pour l'entraînement (training).

* **Questions sur l'emplacement et la modélisation des données de santé**: Madiha Latafi a soulevé la question de savoir si toutes les données de santé, y compris les scores de santé ou les données provenant d'autres sources (comme Journey), devraient être stockées dans MDP. Pierre Fit a estimé que cela devrait être le cas, mais n'avait pas de réponse immédiate concernant les informations d'accès aux soins (comme l'historique des rendez-vous).

* **Coordination de la modélisation des données d'identité et de l'architecture**: Madiha Latafi a insisté sur l'importance de ne pas réinventer des systèmes doubles pour les données d'identité de base (sexe, âge) et autres informations, soulignant la nécessité d'une coordination avec l'équipe de Pierre Fit. Ils doivent se parler pour aligner l'architecture et s'assurer que les données requises sont modélisées en amont pour être consommables par leur équipe.

* **Identification des cas d'utilisation candidats (Use Case Candidates)**: L'étape cruciale est d'identifier les cas d'utilisation candidats pour le trimestre afin de déterminer les points de données nécessaires et de construire la feuille de route. Il a été rappelé que l'objectif principal est de gérer le cas des Rappels de Santé (Health Reminder) dans le sens où ils doivent être capables de demander au contexte patient (PIN context) les utilisateurs correspondant à des critères spécifiques.

* **Proposition de deux cas d'utilisation prioritaires**: L'objectif est d'atteindre la réussite du trimestre en mettant en production au moins un cas d'utilisation par lots (batch). Xavier Villelégier a suggéré Journey (notification d'anniversaire pour enfant) comme un cas d'utilisation de lot existant qui pourrait servir de test pour la forme. Health Reminder a été identifié comme plus complexe en raison des enjeux de sécurité (données MDP déchiffrées) et de la mesure de la précision (accuracy).

* **Avancement sur les questions de sécurité et de confidentialité (Privacy/Security)**: Alexandre Guitton a recommandé d'avancer malgré les débats sur les données déchiffrées de MDP, car le risque n'a pas changé. Des éclaircissements devraient être fournis rapidement par Frédéric Charpandier concernant le hachage des identifiants (IDs).

* **Mise en place d'une preuve de concept (POC) avec Journey et Health Reminder**: L'équipe a convenu de se concentrer sur Notification Journey comme première étape, car cela permettra de valider qu'ils sont capables de récupérer un contexte léger et de le rebalancer en production. Ensuite, ils aborderont Health Reminder, et enfin, la notification REXIS.

* **Feuille de route technique et environnements de test**: Julien a mis en place l'environnement de test et Madiha Latafi a été ajoutée à la discussion technique. Les prochaines étapes incluent la mise en place de données de staging pour créer une vue patient contextuelle simple, l'exploration de l'exposition des données via Big Table ou Feature Store, et le test de deux environnements d'exécution (runtimes) en parallèle (GCP et AWS) pour évaluer la latence et la facilité d'accès.

* **Planification des prochaines étapes et définition des critères d'acceptation**: Alexandre Guitton a proposé que les étapes cruciales (mise en place des données, exposition des données, et essais de runtimes) soient terminées pour la mi-mai. Ils doivent également établir les critères d'acceptation des différentes solutions techniques et réfléchir à la structure des tables pour permettre la segmentation inversée pour les rappels de santé.

* **Timeline pour la mise en place des données et les tests de latence**: L'équipe devrait pouvoir mettre en place les tables cette semaine, dès que Xavier Villelégier aura fourni la liste des colonnes requises à quelqu'un dans Molaire (.Nantes, 4\) (Julien). Une semaine sera nécessaire pour étudier et jouer avec Feature Store et Big Table. Les tests des runtimes (GCP/AWS) devraient commencer autour du 27 mai, impliquant potentiellement les SRE et l'équipe Data Platform.

*Nous vous conseillons d'examiner les notes de Gemini pour vérifier qu'elles ne contiennent pas d'erreur. [Profitez de nos astuces et découvrez comment Gemini prend des notes](https://support.google.com/meet/answer/14754931)*

*Que pensez-vous de la qualité de **ces notes spécifiques ?** [Participez à une courte enquête](https://google.qualtrics.com/jfe/form/SV_9vK3UZEaIQKKE7A?confid=wr7m4sp6WFHrYoLdP3jZDxITOAIIigIgAhgDCA&detailid=standard&screenshot=false) pour nous faire part de vos commentaires et nous dire si ces notes vous ont été utiles.*