# 📝 notes

avr. 15, 2026

## Analytics agent \- indirect PHI handling

Invité [Romain Fays](mailto:romain.fays@doctolib.com) [Arthur Delpierre Coudert](mailto:arthur.delpierrecoudert@doctolib.com) [Lucas Bourdallé](mailto:lucas.bourdalle@doctolib.com) [Aurélien Texier](mailto:aurelien.texier@doctolib.com) [Alexandre Guitton](mailto:alexandre.guitton@doctolib.com) [Yoav Assous](mailto:yoav.assous@doctolib.com) [Cédric Cormont](mailto:cedric.cormont@doctolib.com) [Adèle Lutun](mailto:adele.lutun@doctolib.com) [Louis Perreau](mailto:louis.perreau@doctolib.com) [Alexandre Princ](mailto:alexandre.princ@doctolib.com) ~~[Frédéric Charpentier](mailto:frederic.charpentier@doctolib.com)~~

Pièces jointes [Analytics agent - indirect PHI handling](https://calendar.google.com/calendar/event?eid=NTZtdjd1cWMwdG0wdmY3ZXJha3V1cGw1Zm8gYXJ0aHVyLmRlbHBpZXJyZWNvdWRlcnRAZG9jdG9saWIuY29t)

Enregistrements de réunions [Transcription](https://docs.google.com/document/d/142N2VFtamrMubQ_3xW1A8b1qTIEbqt5mNL2BVVL97E0/edit?usp=drive_web&tab=t.fo4e83ut5eyx) 

### Résumé

La revue de l'Analytics Agent a détaillé l'architecture de sécurité à 3 couches et les garde-fous contre les informations de santé indirectes, avec l'audit des règles par Prodsec requis.

**Sécurité du Plugin et Risques**  
L'agent Analytics permet l'accès à Big Query, augmentant le risque de recouper les données de niveau 1 contenant des informations de santé indirectes. Le déploiement du plugin est désormais automatique, étant installé par défaut derrière la base Doctolib.

**Garde-fous de Sécurité Implémentés**  
La sécurité repose sur 3 couches principales : Risk Assessment, Query Rewriter et Response Filter, pour limiter le transfert de données sensibles. Des règles bloquent la réidentification via l'agrégation minimale à 10 lignes et la restriction des jointures.

**Validation et Audit des Règles**  
L'équipe vise zéro faux négatif, empêchant les requêtes à haut risque d'être exécutées et transférées hors d'Europe. Il est essentiel que Prodsec et l'équipe légale valident formellement les règles d'évaluation des risques et effectuent des tests d'intrusion.

### Étapes suivantes

- [ ] \[Louis Perreau\] Partager Documentation: Partager la documentation de présentation et les liens GitHub vers les règles de sécurité à tous les participants. Envoyer spécifiquement la documentation à Fred.

- [ ] \[Adèle Lutun, quelqu'un dans LVL- Louis Armstrong\] Rédiger Charte: Collaborer pour réfléchir et rédiger des règles spécifiques concernant l'utilisation des outils d'IA pour inclusion dans la Charte IT.

- [ ] \[Adèle Lutun\] Lire Documentation: Lire la page Confluence contenant les détails des règles et des tests d'évaluation.

- [ ] \[Louis Perreau, Lucas Bourdallé\] Créer Diagramme: Créer un diagramme illustrant le flux de données et l'interaction du plugin avec les systèmes Big Query, Cloud et Anthropic pour les non-spécialistes.

### Détails

* **Rappel et contexte du Plugin Analytics Agent**: Louis Perreau a rappelé que l'objectif de la réunion était de discuter de la gestion des informations de santé indirectes (indirect PHI) sur le plugin en raison de la connexion du plugin à l'UHDP, qui contient des données de niveau 1 ([00:00:00](#00:00:00)). Le plugin Analytics Agent permet d'accéder à Big Query en langage naturel et agrège les résultats pour l'utilisateur, fonctionnant comme un pare-feu sur chaque requête ([00:01:44](#00:01:44)). L'accès généralisé à cet outil augmente le risque de recouper les données ([00:00:00](#00:00:00)).

* **Accessibilité et déploiement du Plugin Analytics Agent**: Le plugin est désormais disponible sur la marketplace de Doctolib et ne nécessite aucune installation supplémentaire de la part de l'utilisateur, car il est mis à jour automatiquement au redémarrage du cloud desktop ([00:01:44](#00:01:44)). Il est installé par défaut derrière la base Doctolib, qui fait partie des "connectors" dans l'interface ([00:03:01](#00:03:01)).

* **Structure et compétences de l'Agent Analytics**: L'agent est une orchestration de plusieurs compétences ou "skills", avec "Analyse Data" agissant comme l'orchestrateur principal. Les compétences visibles par l'utilisateur sont "Analyze Data", "Visualize Data" et "Explain Block", tandis que les autres compétences, notamment celles liées à la sécurité, sont invisibles et se déclenchent en arrière-plan ([00:04:00](#00:04:00)).

* **Couches de sécurité de l'Agent Analytics**: La sécurité repose sur trois couches principales : "Risk Assessment", "Query Rewriter" et "Response Filter", chacune ayant une fonction spécifique ([00:05:07](#00:05:07)). La première couche évalue le risque de la question de l'utilisateur (faible, moyen ou élevé), la deuxième réécrit les requêtes à risque moyen, et la dernière effectue une vérification finale des résultats pour s'assurer qu'aucune donnée personnelle n'est compromise avant d'être présentée à l'utilisateur ([00:06:20](#00:06:20)).

* **Évaluation des risques et flux de données**: L'objectif est de limiter à la fois le risque lié aux données envoyées à Anthropic et le risque lié à ce que l'utilisateur voit ([00:07:22](#00:07:22)). Pour les requêtes classées à haut risque, aucune requête n'est même formulée, ce qui garantit qu'aucune donnée n'est transmise ([00:08:14](#00:08:14)). Le processus implique la vérification de l'intention, l'analyse du SQL pour extraire les tables et colonnes, et la classification de ces éléments en termes de risque avant l'application de différents ensembles de règles ([00:09:06](#00:09:06)).

* **Classification des tables et colonnes**: La classification des tables et des colonnes est actuellement codée en dur, basée sur une liste de mots-clés qui, si présents (ex. : mot-clé "patient"), classeraient la table comme à haut risque ([00:09:06](#00:09:06)) ([00:11:37](#00:11:37)). Il est prévu de connecter ultérieurement ce processus au système de gouvernance des données pour une classification automatique et déterministe via la taxonomie contenue dans la couche sémantique ([00:10:19](#00:10:19)) ([00:12:28](#00:12:28)).

* **Gestion des données d'identification directe et indirecte**: Les règles de protection (guard rails) couvrent les informations d'identification directe et indirecte (PHI) ([00:12:28](#00:12:28)). Bien que l'ingestion de PII directes soit déjà gérée par d'autres processus, ces règles agissent comme une première couche de protection si d'autres sources de données devaient être ouvertes à l'avenir ([00:13:35](#00:13:35)).

* **Exemple d'application des règles de risque**: Lorsqu'un utilisateur demande des "rendez-vous par spécialité du mois dernier", le système classe la table "appointment" comme à haut risque ([00:14:31](#00:14:31)). Cependant, comme la demande est agrégée, elle est autorisée, à condition que le résultat final contienne un minimum de 10 lignes, pour éviter l'identification d'individus, ce qui entraînerait une réécriture de la requête si nécessaire ([00:15:28](#00:15:28)).

* **Règles spécifiques concernant les PHI indirectes**: Des règles bloquantes spécifiques aux PHI indirectes sont en place, telles que la limitation à deux jointures et trois clauses "where" ou "group" pour éviter la réidentification par recoupement de tables. D'autres règles bloquent les requêtes de précision temporelle (ex. : à 14h23) ou les fonctions de fenêtre, qui pourraient permettre des résultats trop précis et identifiants ([00:16:36](#00:16:36)).

* **Règles d'agrégation et de granularité temporelle**: Concernant le risque géographique et temporel, les requêtes sont réécrites pour agréger les données au moins par semaine, empêchant l'accès aux données jour par jour. La documentation détaillée de toutes les règles, y compris les liens vers GitHub, sera partagée ([00:18:02](#00:18:02)).

* **Limitations actuelles du Plugin et gestion des transferts de données**: Le plugin ne peut pas couvrir la réidentification en plusieurs étapes (sessions multiples ou utilisation d'outils externes) ou l'utilisation de méthodes statistiques avancées. Les données sont transférées en dehors de l'Europe, et il n'y a pas de mécanisme de consentement en place, ce qui souligne la nécessité de la Gateway prévue pour le deuxième trimestre pour traiter les données en Europe ([00:19:06](#00:19:06)) ([00:30:33](#00:30:33)).

* **Considérations sur la limitation des capacités**: Certaines restrictions, comme le blocage de toutes les jointures ou de l'accès à toutes les tables de praticiens, n'ont pas été mises en place, car elles limiteraient trop la capacité du plugin et dissuaderaient les utilisateurs de l'utiliser ([00:20:27](#00:20:27)).

* **Discussion sur l'adéquation des mesures de mitigation**: Les participants ont discuté si les mesures de mitigation actuelles sont suffisantes pour couvrir le risque de transfert d'informations de santé indirectes, un risque qui n'existe pas avec les outils existants comme Metabase, où toutes les données sont disponibles en clair. Louis Perreau a souligné que les garde-fous mis en place sont un "bonus" par rapport à ce que les utilisateurs peuvent techniquement faire ailleurs ([00:21:49](#00:21:49)).

* **Niveau d'agrégation minimal (Seuil de 10\)**: La nécessité de maintenir le seuil minimum de 10 lignes retournées pour les données a été discutée, en l'absence de ce type de restriction dans les outils comme Tableau ([00:21:49](#00:21:49)). Lucas Bourdallé a confirmé que cette règle est déjà implémentée et fait partie des mesures visant à prévenir la réidentification, notamment pour les petits groupes de patients ([00:22:51](#00:22:51)).

* **Stratégies contre la réidentification de masse**: Il a été confirmé que l'agent et ses règles empêcheront bientôt l'exécution de requêtes de réidentification de masse, même si l'utilisateur tente de contourner le plugin via Cloud Code, car les gardes-fous seront activés automatiquement sur tous les postes ([00:24:37](#00:24:37)).

* **Nécessité de règles d'usage dans la Charte IT**: Adèle Lutun a soulevé la pertinence d'inclure des règles d'utilisation de l'IA dans la Charte IT, annexée aux contrats de travail, pour pouvoir sanctionner l'utilisation abusive ou la tentative de contournement du plugin pour la réidentification. Quelqu'un dans LVL- Louis Armstrong a proposé son aide pour réfléchir à la rédaction de ces règles ([00:25:29](#00:25:29)).

* **Clarification sur le transfert des PHI indirectes aux États-Unis**: Aurélien Texier a exprimé des doutes sur ce qui est légalement permis d'envoyer à Anthropic aux États-Unis, en particulier les combinaisons de colonnes quasi-identifiantes et de HI enrichies ([00:27:27](#00:27:27)). Lucas Bourdallé a souligné que ce n'est pas le plugin qui est en cause, mais la capacité des utilisateurs à le faire via Cloud Code, ajoutant qu'il n'y a aucun ID dans les données traitées et que les garde-fous interdisent la réidentification des petits groupes ([00:28:44](#00:28:44)) ([00:31:32](#00:31:32)).

* **Définition de la validation légale et technique des règles**: La discussion a porté sur la manière dont les seuils (comme le taux de zéro faux négatif) et les règles sont fixés et validés par une partie indépendante ([00:34:15](#00:34:15)). Lucas Bourdallé a expliqué que l'équipe vise zéro faux négatif (aucune requête à haut risque ne passe), mais que l'équipe souhaite vivement qu'une tierce partie (idéalement Prodsec ou l'équipe légale) audite et valide formellement ces règles d'évaluation pour éviter d'être juge et partie ([00:36:03](#00:36:03)) ([00:38:32](#00:38:32)).

* **Prochaines étapes pour l'audit et la revue**: Il a été suggéré que Prodsec effectue des tests d'intrusion (pen test) et qu'Adèle Lutun (côté juridique) examine les documents pour s'assurer de la bonne interprétation et mise en œuvre des règles ([00:39:20](#00:39:20)). Il a également été souligné la nécessité de se synchroniser pour que les tests soient réalisés sur les ensembles de données les plus récents ([00:40:20](#00:40:20)).

* **Demande de documentation du flux de données**: Adèle Lutun a demandé un diagramme de flux de données illustrant l'interaction entre l'utilisateur, le plugin, Big Query et Anthropic, pour clarifier le processus de bout en bout pour les personnes non familiarisées avec la technique. Lucas Bourdallé a accepté de créer ce diagramme ([00:41:11](#00:41:11)).

*Nous vous conseillons d'examiner les notes de Gemini pour vérifier qu'elles ne contiennent pas d'erreur. [Profitez de nos astuces et découvrez comment Gemini prend des notes](https://support.google.com/meet/answer/14754931)*

*Que pensez-vous de la qualité de **ces notes spécifiques ?** [Participez à une courte enquête](https://google.qualtrics.com/jfe/form/SV_9vK3UZEaIQKKE7A?confid=-0qHIwrftLAsobTKoFw5DxIUOAIIigIgAhgDCA&detailid=standard&screenshot=false) pour nous faire part de vos commentaires et nous dire si ces notes vous ont été utiles.*

# 📖 Transcription

15 avr. 2026

## Analytics agent \- indirect PHI handling \- Transcription

### 00:00:00 {#00:00:00}

   
**Louis Perreau:** OK, donc ça c'est le programme de la presse. On essaie de on parle de sécre ça un peu interactif. Donc hésitez pas si vous avez des questions, vous m'interrompez et euh on avance. Donc pour rappel, du coup on est là par rapport aux questions de la question d'Arthur notamment sur OK, comment on gère la partie indirect PHI sur le plugin ? Et pour rappel, histoire qu'on soit tous alignés sur bien ce que ça veut dire, on a la partie direct pi la partie indirecti. Donc je sais pas si tout le monde est OK avec ça mais donc directi tout ce qui est vraiment identifiant name emails, phone number et cetera et indirect phiomisé cas identifier be pattern et cetera. OK pour ça euh pourquoi c'est important ? Pourquoi on parle de tout ça par rapport au plugin ? parce que le plugin il se connecte à l'UHDP qui ose de la donner tier 1 et qui dit tier 1 dit GDPR HDS regulation et le fait que Claude maintenant soit dispo de tout le monde ça rend l'accès à toutes ces données beaucoup plus faciles beaucoup plus simple de cross référencer toute la donnée qu'on a sur le HDP et on a un contrôle limité pour le euh de ces accès en terme euh de qu'est-ce que c'est l'analytics agent ?  
   
 

### 00:01:44 {#00:01:44}

   
**Louis Perreau:** Pour rappel, l'Aytics Agent Plugging, c'est donc un plugin qui permet d'accéder simplement à Big Query en Natural Language et qui agrège les résultats à l'utilisateur. faut le voir un petit peu comme un firewall sur chacune des queries finalement qui seront faites par l'utilisateur avec en plus de ça un une compréhension des data domain grâce au sémantique layer et à garder en tête également c'est bientôt sur la marketplace d'ctolib donc vraiment dispo sans avoir besoin d'installer quoi que ce soit donc voilà ça va avoir un impact sur le nombre d'utilisateur Ouais.  
**Adèle Lutun:** la marketplace sur la page de sur l'interface des stop dont on te parlait tout à l'heure,  
**Louis Perreau:** Hm  
**Adèle Lutun:** elle est où ? Est-ce que c'est un peu comme dust ?  
**Louis Perreau:** hm.  
**Adèle Lutun:** Genre, j'utilise un agent qui est proposé  
**Louis Perreau:** Alors sur la marketplace, alors maintenant que c'est sur la marketplace d'OCTLB, en fait tu n'as plus besoin de faire quoi que ce soit. quand tu redémarres ton desktop euh ton cloud desktop, normalement ça va mettre à jour euh tous tes plugins. Si euh et donc depuis depuis ça, normalement si tu vas dans cl code et que tu poses n'importe quelle question au lieu à la data, ça devrait fonctionner.  
   
 

### 00:03:01 {#00:03:01}

   
**Louis Perreau:** Il y a rien de plus à faire. Il y a pas d'instal.  
**Adèle Lutun:** pas le sélectionner ou quoi que ce soit.  
**Louis Perreau:** Donc comme on se disait exactement depuis qu'il est  
**Adèle Lutun:** Il est là tout le temps. OK. Yeah.  
**Louis Perreau:** derrière la Doctolip Marketplace, donc c'est Doctolip base, tu dois voir si tu vas dans que peu importe cowork ou cloud code, tu vois dans euh comment ça comment ils appellent ça déjà ?  
**Lucas Bourdallé:** C'est les connecteurs non ?  
**Louis Perreau:** Euh les connectors.  
**Lucas Bourdallé:** Ou c'est les artefacts ? Je sais plus.  
**Louis Perreau:** Ouais, c'est ça. Dans dans les connectors euh dans customize, quand tu cliques sur le petit customize, tu vois tes connecteurs, tu vois que par défaut, tu dois avoir Doctolip Base qui est installé et c'est derrière ce Doctolip Base que notre plugging est installé. Donc c'est géré côté Julien Cyril, derrière la Marketplace officielle. Euh et donc a priori, tu as rien besoin de faire. Si tu as un souci, hésite pas à nous mettre un petit euh petit message sur le le channel de la community euh là-dessus et euh on pourra regarder plus en détail, mais à priori censé fonctionner.  
   
 

### 00:04:00 {#00:04:00}

   
**Louis Perreau:** OK pour toi ? OK. Euh la suite, donc euh l'agent analytic, c'est ça. Euh qu'est-ce qu'il y a exactement dans cette analytics agent ? Il y a en fait plusieurs skills, c'est une orchestration de skills. Finalement, on a un skill principal qui est le analyse data et qui joue le rôle d'orchestrateur de tous les autres skills. Ces skills, ils sont pas accessibles directement. Alors, ce soleil sont c'est les skills que l'utilisateur voit, donc le analyze data qui s'occupe de tout orchestré. Et il a également le visualize data et un un skill qu'on appelle explain block. Et il y a tout ce qui est euh pas visible mais qui euh sont tous les les skills qui sont orchestrés par Analyse Data qui tourne derrière. Donc en fait l'utilisateur il le voit même pas. Euh il peut pas les invoquer tout seul. C'est trigger systématiquement par analyse data et ça couvre notamment euh nos tout ce qui est sécurité.  
**Yoav Assous:** M.  
**Louis Perreau:** Donc sur tout ce que l'utilisateur voit pas, en réalité, il y en a trois le trois skills qui sont spécialisés là-dedans.  
   
 

### 00:05:07 {#00:05:07}

   
**Louis Perreau:** C'est notre skill risk assessment, query rewriter et responder filter, response filter pardon. Et le reste c'est par rapport à refresh le contexte, c'est pour la sémantique et query data. C'est le skill qui se occupe vraiment de faire la query à By. Mais donc voilà, le plugging c'est ça, c'est un ensemble de skills. La plupart ne sont pas visible par les utilisateurs. Ils sont de toute façon trigger le analysate sont trigger quoi qu'il arrive quand l'utilisateur pose une question liée à la data et la partie CQ se se tourne tourne en background. C'est OK pour tout le monde ça ? C'est clair ? Cool. Un peu plus en profondeur, qu'est-ce qu'il y a dans cette partie risque ? qui nous intéresse, il y a euh comme je vous disais tout à l'heure les trois layers, le risk assessment, le le query rewriter et le response filter. Chacun des layers a une fonctionnalité spécifique. On va rentrer un peu plus dans dans le détail après. Mais en gros, le premier layer, il va s'occuper de regarder la question d'utilisateur et potentiellement la une query qui aurait été générée en fonction de où se situe dans le flow de l'interaction avec l'agent.  
   
 

### 00:06:20 {#00:06:20}

   
**Louis Perreau:** Et il va évaluer le risque de la question. Donc dans il va mettre ça dans trois catégories, dans un high, médium ou low. On y reviendra après, mais c'est la première chose qui se passe. Euh la 2e partie va s'occuper pour les euh les queries qui sont médium risk, il va s'occuper de les écrire. Si elles sont high, on va juste bloquer la la conversation finalement. Et ensuite, il y a un dernier layer qui est vraiment un dernier backup qui lui va s'occuper une dernière fois. Une fois qu'on a récupéré la donnée de Big Query de faire un dernier check parce que on n pas tout en dans le SQL, il va s'occuper que le résultat est pas compromettant, qui a pas de données personnelles euh en se basant sur la data. Et donc là, Entropique, lui a accès cette donnée puisqu'il a fait la querie. Par contre, l'utilisateur, lui, ne la verra pas.  
**Alexandre Guitton:** Yeah.  
**Louis Perreau:** Euh ce qui est donc ce qu'on attend de Cris. Ouais.  
**Aurélien Texier:** Yes \! Bah du coup, tu viens desc pardon.  
**Louis Perreau:** un peu  
**Aurélien Texier:** Euh juste donc ouais,  
   
 

### 00:07:22 {#00:07:22}

   
**Louis Perreau:** d'éco.  
**Aurélien Texier:** tu viens tu viens quand même quasiment de répondre à ma question mais donc le risque qu'on veut qu'on veut limiter ici, c'est pas le risque de la data qu'on envoie à Claude et le risque de  
**Louis Perreau:** Non,  
**Aurélien Texier:** ce que le user va voir.  
**Louis Perreau:** tout à fait. Là,  
**Aurélien Texier:** OK.  
**Louis Perreau:** on  
**Adèle Lutun:** dans la réponse.  
**Lucas Bourdallé:** Les deux les deux les deux les deux. Là, on parle du dernier layer. Mais avant ce que vous a dit Louis, c'est qu'on avait déjà tout un tas de filtres qui permettent de se dire "Attends,  
**Louis Perreau:** parle.  
**Lucas Bourdallé:** déjà ça ça ira jamais côté antropique." Et c'est à la fin, vous allez le voir en détail mais ce respond filter c'est aussi pour augmenter le pool de de données qui sont retournées. Et avant, il y a tout un tas de batteries, il y a je sais plus combien de règles qui vont empêcher que la donnée aille à tropque.  
**Louis Perreau:** Exactement. Merci Lucas. Et on couvre vraiment les deux. Là, je parlais vraiment juste de la layer 3, c'est effectivement c'est trop tard.  
   
 

### 00:08:14 {#00:08:14}

   
**Louis Perreau:** Par contre, en amont, ce qu'on dit, c'est que déjà, tu vois, tout ce qui est en high et je je vais rentrer un peu plus en profondeur là-dedans dans les slides suivants, mais tout ce qui est catégorie en high, déjà, on fait même pas la query, on ne rédige même pas de query. Euh donc, il y a zéro données. Pareil sur médium, on va agréger, il va y avoir des étapes d'agrégation, des choses qu'on va pas autoriser et cetera. Donc encore une fois, il y a plein de choses que euh euh que qui pourront pas être vu par entropique ou alors ils auront de la donnée encore une fois agrégé et cetera. Ouais. Adel avait une question. Non, pardon, je peux j'ai pas eu le temps de voir ton message.  
**Lucas Bourdallé:** par rapport au de ben avançons parce qu'en fait il y a des choses un peu plus visuelles.  
**Louis Perreau:** Euh ouais.  
**Lucas Bourdallé:** Alors c'est pas forcément ce à quoi tu t'attends Adelle mais il y avait une question côté Louis Armstrong.  
**LVL- Louis Armstrong:** Non, c'est bon, ça répondu.  
**Lucas Bourdallé:** OK.  
**Louis Perreau:** OK, cool.  
   
 

### 00:09:06 {#00:09:06}

   
**Louis Perreau:** Euh OK, donc pour rentrer un peu plus en détail et c'est peut-être ça va peut-être aider à mieux comprendre aussi un peu comment ça fonctionne, à chaque fois que le l'utilisateur va poser une question liée à la data, il va se passer un ensemble de il y a un ensemble de steps qui va être orchestré qui va permettre de de limiter tout ça. Donc déjà, il y a toute une partie de check de lintent. Donc vraiment, on va regarder ce que l'utilisateur il laissait. Il va demander directement, je vais avoir des infos sur tel utilisateur et cetera. On va avoir on va avoir une partie de de parcing du SQL où on va juste extraire les tables, les colonnes et cetera. Ensuite, on va classifier les tables qui pourraient être du coup être utilisé pour répondre à l'utilisateur euh de manière déterministe. Pareil, je vais je crois que je viens un peu plus en détail après, mais euh en gros, on va classer les tables et les colonnes les tables et les colonnes de manière déterministe. C'est-à-dire on a une liste euh de tables où des mots clés, c'est-à-dire si une table contient le mot patient et cetera, elle sera classée comme high risque. une colonne avec qui s'appellerait username, elle va être classée à high risk et cetera.  
   
 

### 00:10:19 {#00:10:19}

   
**Louis Perreau:** Donc ça c'est quelque chose qui va être amélioré dans le futur une fois qu'on sera plus connecté au système de gouvernance pour avoir ça de manière automatique mais on y reviendra. Euh donc voilà, classification des tables, classification des colonnes. Une fois qu'on a toutes ces informations, qu'on a tout classifié, donc le le le l'intent de l'utilisateur, le SQL, les tables à utiliser, les colonnes, on va ensuite faire traverser tout ça dans trois derniers enfin dans trois sets de rules. On va appliquer les rules d'abord qui sont high et je vais vous expliquer un peu plus en détail après quels sont ces rules exactement, mais on va appliquer un set de rules euh qui sont plus ou moins high, médium ou alors dernière étape, il y a plus aucun risque et ça passe, la query est exécutée et l'utilisateur aura une réponse sur la donnée. Est-ce que ce concept déjà de de plusieurs évaluations de risque qui permet ensuite l'application des règles, ça c'est à peu près compréhensible ou vous avez des questions là-dessus ? Ouais,  
**Cédric Cormont:** Ouais,  
**Louis Perreau:** cool.  
**Cédric Cormont:** j'avais mais bon peut-être que c'est le lieu juste quand on parle de classification des tables et des colonnes, c'est basé du coup sur quoi pour faire cette classification ?  
   
 

### 00:11:37 {#00:11:37}

   
**Cédric Cormont:** utilise pas la data taxonomie tout ça  
**Louis Perreau:** Non, ce que je disais tout à l'heure,  
**Adèle Lutun:** C'est la même disco.  
**Louis Perreau:** c'est qu'en fait aujourd'hui c'est vraiment hardcodé.  
**Cédric Cormont:** là.  
**Louis Perreau:** C'est une liste de mots clés qu'on va rechercher dans le nom des tables ou ce genre de choses. Donc on une liste qui est vraiment dans le code, qui est hardcodé, qui vraiment être défini de manière très subjective he d'une certaine manière. Enfin, on a on a essayé de couver un maximum de choses en attendant d'être effectivement connecté à tout ce qui est datagou qu'on puisse avoir c accès à cette info de manière automatique et là effectivement ce sera parfait. on pourra avoir cette info vraiment.  
**Lucas Bourdallé:** C'est c'est prévu dans un incrément si vous voulez tout savoir. C'est le prochain incrément mais qui est en lien avec la sémanter puisque bon la sémanti layer c'est juste si vous voulez un petit dictionnaire pour ceux qui sont  
**Louis Perreau:** Ouais.  
**Lucas Bourdallé:** pas très à là-dessus qui nous donne un peu plus de compréhension sur est-ce qu'il faut aller chercher la data et comment se comportent les tables entre elles.  
   
 

### 00:12:28 {#00:12:28}

   
**Lucas Bourdallé:** Euh où sont les règles métiers et cetera. Donc cette fameuse couche sémantique qui apporte de de de la sémantique à à toute la data va contenir de la taxonomie.  
**Louis Perreau:** І  
**Lucas Bourdallé:** Donc une fois que cet incrément a été réalisé et donc ça c'est sous pilotage de YAV, bah nous on pourra se brancher dessus, on est déjà actuellement et au lieu d'être sur de l'intention des choses un peu LLM as a judge et un peu déterministe, là on sera beaucoup plus sur quelque chose de déterministe qui sera OK ce champ il est de telle taxonomie donc ben par mécanisme ça va donner ça à la fin et là sera encore plus simple pour le plugin de de de gérer ses risques.  
**Aurélien Texier:** Ouais, en fait moi ma question c'était ça, c'est que quand tu te citais first name, last name et tout ça, en fait pour moi il y a il y a pas de patient direct pi dansp. Donc en fait ce enfin pour pour le coup c'est des trucs qui peuvent être checkés mais en on fait en sorte qu'à l'ingestion on n'ère pas ça. Donc c'est uniquement basé sur tout ce qui est détection de indirect pi ou indirect  
**Louis Perreau:** les deux et et tu as totalement raison de soulever le point.  
   
 

### 00:13:35 {#00:13:35}

   
**Aurélien Texier:** C'est  
**Louis Perreau:** Effectivement, on a un certain nombre de guard rails qui sont liés à de la PA qui ont pas forcément ils sont pas forcément nécessaires. Je pense qu'on pourra refaire une passe. On a essayé vraiment de blinder le truc. A priori, tu as raison, il y a aucune raison qui la P.  
**Lucas Bourdallé:** pour l'instant.  
**Louis Perreau:** Mais si je c'est  
**Lucas Bourdallé:** Après si un jour il y en a  
**Adèle Lutun:** Par exemple, ceux qui utilisent le comme Fred là qui disent que ceux qui ont le farming en plus,  
**Lucas Bourdallé:** bon  
**Louis Perreau:** ça,  
**Adèle Lutun:** est-ce que du coup ça va permettre justement ces garder de bloquer le matching avec genre le farming ?  
**Lucas Bourdallé:** c'est exactement  
**Louis Perreau:** par exemple, c'est ça, c'est qu'aujourd'hui, on est vraiment connecté que à un certain nombre de tabs dans Bquery, vraiment dans la zone AE, qui sont même d'ailleurs des tables DTM, des dataset et cetera. Demain, si on ouvre les vannes côté d'autres sources de données où c'est pas forcément géré, on a déjà ces garder en  
**Lucas Bourdallé:** Après c'est qu'une première RBch,  
**Louis Perreau:** place.  
**Lucas Bourdallé:** ça fait 10 jours que l'équipe est là.  
   
 

### 00:14:31 {#00:14:31}

   
**Lucas Bourdallé:** Pour l'instant, c'est une première éb sur lequel on a essayé de se de penser un peu et d'anticiper OK, il peut y avoir le farming, il peut y avoir d'autres choses qui vont arriver, qu'est-ce qu'on peut mettre qui agit comme un firewall qui déjà fait cet incrément de valeur en terme de risque pour toute la boîte ? Mais effectivement, vous levez des points où il faut qu'on aille un peu plus loin maintenant.  
**Louis Perreau:** Euh OK. Donc en fait là finalement je vais pas revenir trop là-dessus, c'est ce que je vous expliquéis tout à l'heure. De manière déterministe, on en discutait, on définit une sensibility pour les tables et les colonnes. Un petit exemple à rapidement, peut-être que ce soit plus parlant, qu'est-ce qui se passe si l'utilisateur demande euh juste appointment perspalty last months. Il y a tous les checks dont on parlait tout à l'heure qui sont qui tournent. On va regarder l'intent de l'utilisateur. OK, a priori il veut juste les intent par speciality. pas de problème. Euh le SQL group buy et cetera. Donc pas de problème.  
   
 

### 00:15:28 {#00:15:28}

   
**Louis Perreau:** Table appointment, attention, on est quand même sur des tables appointment qui sont classifiées en at risque, donc on flag un high. Euh classify column specialty, c'est safe, pas de problème. Euh sur les roues euh high, on est au niveau agrégé, donc il y a pas de problème. Attention quand même euh que dans le résultat de la query finale, on est bien quand même un un minimum de 10 lignes. S'il y a moins de 10 lignes, c'est un gardeste qui est un peu fort et qui serait pas forcément nécessaire dans ce cas-là, mais on veut jamais qu'il y ait moins de 10 lignes retournées. Donc euh il va y avoir un un rewite de la de de la de la query qui va être fait euh pour être certain d'avoir tous ces gardes rais. Euh donc mais l'utilisateur au final aura accès à la donnée dont il voulait, il aura bien les appointment per speciality. Donc ça c'est une bonne nouvelle. Euh deep dive. OK, on voulait parler des indirect PHi. Donc parlons des indirect PHI spécifiquement sur tous les gardes, sur toutes les rules dont je vous parlais tout à l'heure. Je vous ai dit, j'y reviendrai.  
   
 

### 00:16:36 {#00:16:36}

   
**Louis Perreau:** Qu'est-ce que c'est ces rules ? Et on a un certain nombre de rules qui sont dédiés spécifiquement à l'indirect PHI. Voilà quelques rules. Par exemple, dans les rules qui sont bloquantes spécifiques pour une direct, on a tr on en a en gros trois qui sont pour tout ce qui est cross table reidentification. Euh donc onutorise pas plus de deux jointures et plus de en fait finalement euh trois we close ou group. Euh du coup euh on on systématiquement dans ces cas-là on bloquera euh pareil sur tout ce qui est time stamp precision. Donc si quelqu'un essaie de de chercher ce qui s'est passé par exemple à 14h23 à telle date pour essayer de trouver un ce qui s'est passé sur un individu ou quoi, ça sera bloqué. et euh tout ce qui est window function, donc pareil des systèmes de ranking et cetera qui permettraient de manière un peu judicieuse d'obtenir des résultats très fins et donc identifiants. Donc ça c'est les trucs qui sont vraiment bloquants dans les trucs euh où c'est pas bloquant mais on va réécrire les queries euh il y a finalement les règles en place narotime et géographie. Euh donc là, c'est tout ce qui est voilà pour euh éviter d'avoir des des petits des tout petits cohorts.  
   
 

### 00:18:02 {#00:18:02}

   
**Louis Perreau:** Euh donc on va agréger euh au mois euh ou à la semaine, mais on va éviter euh ce sera à la semaine minimum, on aura pas la possibilité de regarder la donnée jour par jour.  
**Lucas Bourdallé:** Mon cher Louis, je crois que il nous reste 4 minutes. C'est juste pour  
**Louis Perreau:** Ah merci de garder un œil sur le temps. Ouais. Donc de toute façon dans cette documentation, on va vous la partager à la fin de de la presse.  
**Lucas Bourdallé:** faire  
**Louis Perreau:** Vous voyez tous les liens vers même les règles en détail dans GitHub. Donc vous pouvez vraiment aller regarder toutes les règles sont en place. Je vais aller un peu plus vite du coup mais voilà, on a ça c'est les dernières règles. Euh au moment où on récupère les résultats de la query, on vérifie voilà qu'il y ait un minimum de ligne euh et qui est pas de PII. Mais là, on est encore, on est déjà sorti de tout ce qui était vraiment purement PHI. Euh donc, je pense que je vais aller rapidement là-dessus. Euh ça c'était un exemple, vous pourrez regarder mais on en a vu un tout à l'heure, c'est assez similaire. Juste un petit point sur la partie évaluation.  
   
 

### 00:19:06 {#00:19:06}

   
**Louis Perreau:** On a des tests d'évaluation qui sont en place qui sont en place dans Braint Trust et qu'on fait tourner également au local à chaque fois qu'on fait des modifs. Donc on a beaucoup de golden dataset de dataset qui nous permettent finalement d'être de de tourner à chaque fois qu'on fait une modification euh on a voilà c'est ces garder en place euh et ça nous permet voilà de vérifier qu'on a pas de régression et cetera. Euh rapidement, on en a déjà un peu parlé quand même au meeting précédent, mais dans les trucs qui sont pas couverts et qui peuvent pas être couverts aujourd'hui par le plugin, tout ce qui est réidentification en multistep. Si quelqu'un ouvre une nouvelle session cloud, garde sauvegarde les résultats, ouvre plusieurs sessions, on peut rien y faire. Euh pareil s'il fait ça, en dehors de cloud, euh pareil s'il utilise des des méthodes de statistique un peu poussé. Euh voilà. Et dans les autres limitations qu'on connaît également, c'est qu'on sait que aujourd'hui le data est transféré quand même en dehors de de l'Europe euh et euh voilà, il y a pas de de consent en place. Donc euh les Ah oui, pardon, les dernières choses rapidement, on a aussi un certain nombre de choses qu'on a décidé de ne pas mettre en place, qu'on pourrait mettre en place, des gardes rais notamment en direct ph.  
   
 

### 00:20:27 {#00:20:27}

   
**Louis Perreau:** Pourquoi on les a pas mis en place ? parce que on estime qu'elle serait beaucoup trop limitante en terme de capacité du plugin et mais là on est vraiment sur voilà bloquer toutes les jointures, bloquer l'accès à toutes les tables practitioner avoir que une granularité au moins. On pourrait avoir faire ce genre de chos là je pense qu'on perdrait vraiment en traction avec l'outil et les gens utiliseraient plus l'outil je pense. Désolé, on est un petit peu long. On a encore une minute ou un peu plus pour ceux qui ont le temps pour les autres questions. Ouais.  
**LVL- Louis Armstrong:** Euh moi c'était pas une question euh sur votre CR particulièrement que je trouve top by the way. Euh c'est plus une question pour du coup les autres personnes conviv à ce meeting. Euh le but c'est enfin le but de ce meeting c'était de s'assurer pour reboucler que en fait ce qui a été mis en place ça correspond bien à ce qu'on est censé faire en terme de mitigation tu vois par rapport au risques qu'on avait listé dans le dans le document et du coup je pense c'est hyper important d'avoir vos feedback là-dessus enfin je te vous vois un peu Adelle mais aussi Aurel qui qui sont hyper dire sensibilisé au sujet.  
   
 

### 00:21:49 {#00:21:49}

   
**LVL- Louis Armstrong:** Euh et du coup le but c'est d'avoir un un retour de votre part sur est-ce que vous avez des zones de doute ou est-ce que ce qui a été mis en place ça vous semble suffisant pour être s dans un premier temps avant de passer par J getway level 2 et cetera et cetera quoi.  
**Adèle Lutun:** Ben moi, j'avais une question sur le sur le seuil là des 10\. Est-ce que aujourd'hui dans des outils comme tableau et cetera, il y a déjà le seuil de 10 qui est imposé ou pas ?  
**LVL- Louis Armstrong:** Non.  
**Louis Perreau:** Non,  
**Lucas Bourdallé:** Non, il y a les données en clair.  
**Louis Perreau:** là finalement de manière générale tous les garder race qu'on a en place là c'est  
**Adèle Lutun:** Non.  
**Louis Perreau:** du bonus par rapport à ce qui existe déjà et ce que les utilisateurs peuvent techniquement faire. Mais tu  
**LVL- Louis Armstrong:** Aujourd'hui dans juste aujourd'hui dans Metabase,  
**Louis Perreau:** fais  
**LVL- Louis Armstrong:** tu peux absolument faire tout ce qui est interdit avec le plugin en fait.  
**Louis Perreau:** c'est ça,  
**Adèle Lutun:** C'est juste que comme il y a pas de transfert, on est plus sympa.  
**LVL- Louis Armstrong:** Ouais. En fait, les risques les risques à couvrir là-dessus, c'est vraiment le transfert des indirects PHI.  
   
 

### 00:22:51 {#00:22:51}

   
**LVL- Louis Armstrong:** Donc s'assurer que c'est bien couvert avec ce qui a été présenté et la doc et le fait principal c'est la réidentification  
**Adèle Lutun:** Ouais. Bah du coup, je me demande si le 10, le seuil de 10, est-ce qu'il faudrait pas le rendre en obligatoire ?  
**LVL- Louis Armstrong:** toute  
**Adèle Lutun:** Tu disais que c'était un strong requirement Louis dans une des règles. Euh je pense qu'il faudrait voir si ça peut pas être une enfin est-ce queil y a moyen de le rendre enfin est-ce que  
**Louis Perreau:** Ouais.  
**LVL- Louis Armstrong:** un énorme travail.  
**Adèle Lutun:** c'est ça serait très comment ?  
**LVL- Louis Armstrong:** C'est un énorme travail. Tu veux dire dans ta voix ?  
**Adèle Lutun:** OK.  
**LVL- Louis Armstrong:** Bah partout parce que du coup  
**Adèle Lutun:** Non non mais je parle là dans dans celui-là dans  
**Louis Perreau:** de le réduire.  
**LVL- Louis Armstrong:** Ah.  
**Lucas Bourdallé:** Ah, ce qu'on t'a montré,  
**Adèle Lutun:** dans les règles de le 10\.  
**Lucas Bourdallé:** c'est déjà c'est déjà implémenté, Adel. Oui.  
**Adèle Lutun:** OK, j'ai  
**Louis Perreau:** Oui.  
**Lucas Bourdallé:** Et on a même d'autres choses qu'on a pas voulu mettre.  
   
 

### 00:23:41

   
**Lucas Bourdallé:** Il y a aussi le fait de pouvoir rapprocher les euh en fait trois principes à ce niveau-là.  
**Adèle Lutun:** J'aime  
**Lucas Bourdallé:** Donc tu as la canonimity mais tu as aussi des résultats qui peuvent même être proches même sur beaucoup de lignes et qui peuvent permettre de réidentifier quelqu'un. C'est des choses qu'on a pas mis en place parce que c'était un peu du bon voilà mais on s'est mis au plus près de l'état de l'art en tout cas. Donc ça, tu l'as déjà en place et c'est déjà c'est le c'est le moment où on envoie les données à Claude pour dire attends quoi qu'on appelle BQU pour dire attends combien on a de data et si on voit qu'on en a moins que 10 euh parce qu'on a vu on voulait un praticien ou un patient tu vois qui a a pas la vass et que finalement c'est le seul on s'est  
**Adèle Lutun:** Ok.  
**Lucas Bourdallé:** dit attends là on va devoir rewrite tu vois la query et c'est là où et comme l'a dit Louis je tiens à le signaler de toute transparence à un moment donné on envoie les données à BQU donc à un moment donné, il peut y avoir à la toute fin de la donnée qui passe par euh le par quoi qui est processée côté anthropique.  
   
 

### 00:24:37 {#00:24:37}

   
**Lucas Bourdallé:** En attendant, on l'a vu qu'on a déjà la solution euh qui est déjà dans ton backlock d'ailleurs euh qui est la gateway et  
**LVL- Louis Armstrong:** Mais très très concrètement euh du coup tu peux  
**Lucas Bourdallé:** cetera.  
**LVL- Louis Armstrong:** faire tout danse. Tout ce qui est interdit avec le plugin, tu peux le faire dansabase. Mais par exemple, si tu veux faire de la réidentification de masse quand même avec l'audera le SQL. Enfin, en gros, tu peux sans utiliser le plugin rien. Tu prends Cloud Code, tu lui dis "Je veux faire de la réidentification de Max." Tu prends notre Gitub qui est euh qui est public.  
**Adèle Lutun:** Ok.  
**LVL- Louis Armstrong:** Euh aujourd'hui, tu refais de la réidentification de masse  
**Lucas Bourdallé:** C'est presque presque plus possible parce qu'on est à ça de mettre ça en  
**Louis Perreau:** C'est à partir du moment  
**LVL- Louis Armstrong:** en  
**Lucas Bourdallé:** obligatoire sur tous les postes à tout le monde. automatiquement.  
**Louis Perreau:** Ouais.  
**Lucas Bourdallé:** Ouais, ça va devenir en fait ça va de suite faire un firewall et ça va bloquer.  
**Louis Perreau:** debout.  
**Lucas Bourdallé:** Même si tu dis "Vas-y, mais je le fais en cloud code, ça va bloquer.  
   
 

### 00:25:29 {#00:25:29}

   
**LVL- Louis Armstrong:** nice, ça c'est Ok.  
**Adèle Lutun:** Et du coup, un point qui est pas qui est pas euh du coup plutôt de votre côté, mais qui était un point que j'avais mis dans la conversation Slack, c'est la pertinence de mettre des règles sur l'usage. Mais ça, on est plus dans la mitigation des risques sur plus général sur les outils DIA. du coup de de voir pour peut-être mettre des choses dans l'IT Charter dans laquelle on a déjà des règles sur comment on utilise les outils, je sais pas genre le téléphone, c'est pas que pour envoyer des SMS persos et tout ça. Et ça du coup vous étiez j'avais l'impression que vous étiez quand même tous plutôt partant. Euh est-ce que du coup il y aurait quelqu'un qui pourrait peut-être réfléchir avec moi sur des règles qui pourraient être inscrites dans la charte IT qui soient pas des trucs qui soient ahurissants parce que moi je peux aider à rédiger mais je pas forcément beaucoup d'idées sur les bonnes pratiques qu'on voudrait écrire.  
**LVL- Louis Armstrong:** Je peux je peux t'aider si tu veux  
**Adèle Lutun:** OK.  
**LVL- Louis Armstrong:** faire un point priorise le  
**Aurélien Texier:** J'ai juste une question par rapport à ça,  
   
 

### 00:26:39

   
**LVL- Louis Armstrong:** concept on s'occupe de la Ça va ?  
**Aurélien Texier:** mais juste en question,  
**Adèle Lutun:** OK.  
**Aurélien Texier:** j'ai je suis pas sûr. La la charte, c'est c'est dire quelles sont les baisses practices. C'est ça au sein de Doctol.  
**Adèle Lutun:** Bah ça serait en fait le truc c'est que la charte IT c'est annexé au contrat de travail. Donc en fait si jamais il y a des on se rend compte qu'il y a une utilisation un peu frauduleuse, tu vois, genre de Lia et cetera. par exemple,  
**Aurélien Texier:** D'accord.  
**Adèle Lutun:** quelqu'un qui euh utilise euh justement qui veut contourner le plugin pour réidentifier massivement euh bah ce genre de comportement, on pourrait éventuellement du coup le sanctionner euh parce que du coup on aura écrit des choses du  
**Aurélien Texier:** Ah \!  
**Adèle Lutun:** genre euh quand vous êtes chez Docto, vous cherchez pas à identifier euh enfin ce genre de règle qui en fait nous permettrait de se dire si demain on met un peu de temps à se rendre compte qu'il y a un nouveau truc qui est sorti et on met du temps à se rendre compte des risques qui sont inhérents à ça, mais que quelqu'un s'en est déjà rendu compte et a utilisé euh à mauvais essiant et en étant conscient de  
   
 

### 00:27:27 {#00:27:27}

   
**Aurélien Texier:** Угу.  
**Adèle Lutun:** ça, ben ça peut nous mettre aussi des gard rails nous pour dire que on met des choses en place pour prévenir et même si c'est pas je veux pas que qu'on le fasse mais que éventuellement prendre des sanctions contre des gens qui auraient une utilisation nocive de certains outils  
**Aurélien Texier:** OK. Ah oui,  
**Adèle Lutun:** quoi.  
**Aurélien Texier:** OK, je comprends. Euh  
**Adèle Lutun:** OK, merci. Yeah.  
**Aurélien Texier:** et du coup euh Ouais, je le vais la main aussi juste àir moi en fait le truc est pas encore si clair,  
**Louis Perreau:** Oui.  
**Aurélien Texier:** c'est ce qu'on envoie à Claude et ce qu'on a le droit d'envoyer à Claude au niveau de l'IR Pietcha. Et moi c'est plus ça sur lequel j'ai c'est enfin le risque interne dont on parlait avant c'est autre chose mais c'est plus comment est-ce qu'on s'assure vraiment que euh dans une table qui contient une colonne indirect PII patient plus une colonne HI avec les deux ou trois joint qui vont bien en plus comment est-ce que ce groupe là de de truc qui devient que des quasi identifier comme vous les avez appelé plus de la HI enrichi comment ça en en fait n'est euh enfin est-ce que c'est OK de l'envoyer aujourd'hui à Claude et et aux US quoi ?  
   
 

### 00:28:44 {#00:28:44}

   
**Aurélien Texier:** Moi c'est moi c'est plus ce truc là sur lequel j'ai  
**Lucas Bourdallé:** OK, mais ça du coup c'est pas le lié au plugin du coup parce que le plugin lui de toute façon c'est les gens les gens le font déjà  
**Aurélien Texier:** Ah.  
**Louis Perreau:** Ouais.  
**Lucas Bourdallé:** avec Cloud tu vois donc le le plugin lui il là-dessus n'est pas en cause. Par contre, euh peut-être que quand on aura la taxonomie,  
**LVL- Louis Armstrong:** ce  
**Lucas Bourdallé:** on pourra effectivement mettre des en place euh des choses plus déterministes. Si tu as ça en tête aussi, Aurel, se dire si on fait des quas identifier, vas-y, il faut bloquer quoi, on pourra mettre des choses claires.  
**LVL- Louis Armstrong:** Je pense qu'il faut que nous on fasse attention à ça. Mais ce que disait Éric l'excellent sur les commentaires, c'est bah ça c'est enfin c'est c'est le contrat qu'on a avec en tropique et il a l'air de dire que c'est OK, tu vois. Enfin,  
**Lucas Bourdallé:** sur la rétention seulement sur la rétention  
**LVL- Louis Armstrong:** ouais, mais du coup, sauf qu'il dit que ça suffit, tu vois.  
   
 

### 00:29:27

   
**LVL- Louis Armstrong:** Euh, qu'est-ce qu'est-ce qui suffit ? Bah le enfin qu'aujourd'hui, euh la restriction, elle est pas sur le fait d'envoyer de la direct la quasi quasi direct.  
**Lucas Bourdallé:** Le problème c'est qu'on a c'est que c'est processé aux US. C'est juste  
**Aurélien Texier:** Ouais, c'est No.  
**Lucas Bourdallé:** ça.  
**LVL- Louis Armstrong:** Mais il me semble que il me semble qu'on a pas on a pas le droit de processer la donnée indirect.  
**Lucas Bourdallé:** Oui, c'est  
**LVL- Louis Armstrong:** Non.  
**Adèle Lutun:** Et sur ça d'ailleurs euh euh pardon mais euh donc là c'est  
**Lucas Bourdallé:** ça.  
**Adèle Lutun:** par Oh là là euh est-ce que euh il y a un moyen de  
**LVL- Louis Armstrong:** Et du coup ça Ah.  
**Adèle Lutun:** s'assurer par exemple que euh pour le futur tout ce qui parce que de ce que j'ai compris qu' il y a les environnements 1P et 3P qui génèrent pas les mêmes risques de transfert et il y a rien qu'on puisse faire pour s'assurer qu'on est que dans 1 P ou que à chaque fois qu'on est dans 3P, on passe par la gateway.  
   
 

### 00:30:33 {#00:30:33}

   
**LVL- Louis Armstrong:** Le le but à terme c'est de passer par la gateway ce qui nous permettra de processer les données en Europe et à ce momentl on sera  
**Adèle Lutun:** Oui oui  
**LVL- Louis Armstrong:** tranquille. Donc là c'est court en Q2 et en attendant on est en 1P si je dis pas de bêtises. On passe par tropic directement et du coup là les données sont processé aux US et donc on n pas le droit de  
**Adèle Lutun:** Voilà.  
**LVL- Louis Armstrong:** processer des indirects P. Mais du coup, est-ce qu'on direct PHI à partir du moment où euh c'est si renvoie le résultat qu'il y a des Ouais, c'est dans la réponse c'est si dans ta réponse fiche du coup des indirect. Mais dans quel cas du coup tu as Oui. Oui. Quand tu commences à faire un truc un peu  
**Aurélien Texier:** Bah pour moi ça ça c'est le cas assez rapidement en fait. C'est pour ça c'est pour ça que pour moi c'est un peu la zone d'ombre.  
**LVL- Louis Armstrong:** du exemple précis du SK Business par  
**Aurélien Texier:** dès que tu as des Bah en fait moi je ser dans ce cas-là on peut se  
**LVL- Louis Armstrong:** exemple.  
   
 

### 00:31:32 {#00:31:32}

   
**Aurélien Texier:** pencher sur des exemples de réponses de requête que vous pouvez avoir en tête où on peut regarder une simple agrégation de nombre de d'appointment splitté par specialty a priori non mais dès que tu as des ID en fait qui vont remonter dans les résultats  
**LVL- Louis Armstrong:** Oui, mais du coup qui processe des enfin tu vois genre moi je  
**Lucas Bourdallé:** Ah,  
**Aurélien Texier:** He.  
**Lucas Bourdallé:** on a aucun ID. Juste pour info,  
**Louis Perreau:** Yeah.  
**Lucas Bourdallé:** on a aucun ID parce que avec l'ID 100 % d'accord avec toi Aurel, on peut quoi ? C'est l'indirect PHI. Donc non, on a aussi un gard là-dessus, c'est qu'il y a pas d'ID et même le nombre d'appointment, encore une fois, je le rappelle, si on demande le nombre d'appointment euh d'un praticien très une spécialité très particulière dans une  
**Adèle Lutun:** M.  
**Lucas Bourdallé:** petite ville vraiment dans des zones hyper rurales où tu as trois patients combinés avec un join qui permettrait de revoir quelqu'un ou un autre quoi. Tout ça c'est interdit. Et c'est là où on refait les stressholds. C'est là où même on dit euh avant même d'envoyer la donnée, on fait aussi de la réécriture.  
   
 

### 00:32:23

   
**Lucas Bourdallé:** Ça, je sais pas si c'est clair, mais avant même d'envoyer la donnée, si on voit qu'il y a pas un minimum un genre de account, c'est bloqué.  
**LVL- Louis Armstrong:** Et peut-être enfin ce que je veux dire c'est plus plutôt que de dire il y a un hypothétique truc si Aurel tu peux prendre le truc de nous identifier un cas tu vois concret de là cet exemple là concrètement il a risqu  
**Lucas Bourdallé:** et et même peut-être pour simplifier la la vie Aurélien, il y a peut-être un truc qu'on pourra faire encore plus simple, c'est que là on va avoir la taxonomie avec tu sais tel champ et direct pi celui-là et ça on a les règles. Là, c'est plus mathématique. Mais si tu nous dis en gros les gars, si vous avez cette colonne qui est direct pi mais que vous avez une autre colonne qui est indirect PHI, à la fin une et ça si tu nous dis les règles, ben là on le fait là, tu vois, c'est vraiment déterministe quoi. C'est cartésien.  
**Adèle Lutun:** Ce sera un très bon usage de la data taxonomie.  
**Aurélien Texier:** Yes \! Mais on peut peut-être aller sur des log de query qui ont été retourné.  
   
 

### 00:33:26

   
**Aurélien Texier:** Enfin comme ça, on regarde en fait s'il y a déjà eu des des cas ou enfin je sais pas si c'est simple mais ou autrement Ah  
**Lucas Bourdallé:** On n'est pas la télémétrie encore. En fait, on l'a mais c'est compliqué mais c'est une autre histoire.  
**Aurélien Texier:** vous avez pas OK Ok.  
**Lucas Bourdallé:** Mais on va la voir. On va la  
**Louis Perreau:** Après, tu peux check si tu veux,  
**Aurélien Texier:** Ok.  
**Lucas Bourdallé:** voir.  
**Louis Perreau:** tu peux être promené sur le Ripo et checker le dataset des val. Tu verras, il y a il y a dans les dataset des valal, tu as plein d'exemples de de justement euh de toutes les catégories de tout pour chaque règle dont on a  
**Lucas Bourdallé:** On fait le test.  
**Louis Perreau:** parlé, tu as euh des tests des datasets. Donc euh ouais,  
**Lucas Bourdallé:** Teste sinon  
**Louis Perreau:** teste-le, je pense c'est le meilleur moyen. Cool. Alexandre, tu avais une une question  
**Alexandre Guitton:** Ouais. Et c'est c'est juste un peu à côté mais euh le le comment  
**Louis Perreau:** ?  
**Alexandre Guitton:** dire là là du coup ça c'est toutes les règles qui sont mis en place.  
   
 

### 00:34:15 {#00:34:15}

   
**Alexandre Guitton:** Vous avez des dat des pardon des dataset deval avec des scores de résultat de coverage de d'accury je sais pas quoi. Comment ça se passe du coup après entre du coup d'un point de vue légal, on a dit on décide que ces guilles sont les bonnes ou sont suffisantes pour mitiger le risque et on accepte un pourcentage d'erreur parce que je prends par exemple ce qu'on a fait ce qui a été fait là sur la partie pseudonization. On sait que quand on passe de la prod du tier 0 au tier 1, on a un pourcentage qui a été accepté. On sait qu'il y a il y a des trucs qui vont passer. On c'est pas faut qu'on mitige au maximum mais c'est OK que ça passe parce que bah on on on en terme de pourcentage on est à l'aise avec ce chiffre làà en gros comment on fait cette bascul entre du coup vous avez vos dataset level devel vous avez les règles qui sont les bonnes et en gros on a quelqu'un qui audite slash valide que les résultats sont bons et sont suffisants pour se dire que on est vraiment confiant c'est dire que c'est pas juste sur les slides où on est d'accord c'est dans la réalité de ce qui se passe.  
   
 

### 00:35:14

   
**Alexandre Guitton:** On est d'accord et on est au bon niveau.  
**Lucas Bourdallé:** Alors,  
**Alexandre Guitton:** Ça ça se passe comment ?  
**Lucas Bourdallé:** deux réponses. Euh la première euh c'est quoi nos nos finalement strold de pour se dire on est bon, on n'est pas bon. Je vous l'ai mis en commentaire avec un exemple, c'est qu'on a fait retourner tout à l'heure, zéro de force négative. Euh pour euh pour les profan c'est en gros on passe pas à travers les règles qui devraient être les rules high,  
**Alexandre Guitton:** He.  
**Lucas Bourdallé:** on les considère pas comme médium. On se permet de faire l'inverse. On se permet que quelque chose qui serait médium que nous on le bloque, c'est pas très grave. C'est juste dommage pour l'utilisateur mais c'est pas très grave. Par contre, on a du zéro sur le false négatif. Donc ça c'est la première la première réponse à ta question. Où où on met la barre ? la seconde à savoir ouais mais du coup les règles qui les a fixé et qui les valide et ben ça c'est nous il y a quelques jours, on s'est dit comment on on gère ça ?  
   
 

### 00:36:03 {#00:36:03}

   
**Lucas Bourdallé:** Comment ça devrait marcher ? Je sais pas qui devrait les prendre en place quoi. Qui devrait les prendre en main ces règles d'évaluation devrait les relire et cetera. Je sais pas. Et si une équipe veut s'en veut le récupérer euh avec grand plaisir, je pense qu'on pourra accompagner. C'est aussi pour ça qu'on a fait ce document et cette présentation. On a pris du temps à le faire. Euh vous avez pu le noter, c'est que on veut aussi passer ça à d'autres équipes pour que tout le monde vienne aussi participer. Euh on a aussi fait des choses propres sur Braint Trust où on peut faire des sets, des évaluations, on peut faire plein de choses. Nous, on est chaud. Si quelqu'un vient nous voir et nous  
**Alexandre Guitton:** Je sais pas Auréen, tu sais comment ça s'était passé là pour la pseudo qu'en fait comment les seuils ont été fixés slash comment le truc a été audité pour dire bah c'est c'est bon on y va. parce que c'est juste la la les data scientist ont dit bah c'est ça le score et puis on leur a mis un tampon sur le score.  
   
 

### 00:36:54

   
**Alexandre Guitton:** Il y avait pas il y avait pas de partie sorte partie entre guillemets entre celui qui produit le le test, celui qui produit l'outil et celui qui valide ou est-ce que juste c'est zones grises et on est dans la même situation que là  
**Aurélien Texier:** Non,  
**Alexandre Guitton:** ?  
**Aurélien Texier:** le il y a les data scientistes ont vraiment fait des études sur des dataset donné sur lequel ça a donné lieu à une page confluence. et les échanges avec les teams en question. Je pense la question c'est est-ce qu'il avait une tierce partie  
**Alexandre Guitton:** Ouais. C'est est-ce que c'est eux qui on fait tout seul qui ont sélectionné le dataset qu'on fait l'évaluation qui donn le résultat et qui ont  
**Aurélien Texier:** ?  
**Alexandre Guitton:** dit enfin après il y a potentiellement quelqu'un à côté genre procès des équipes comme ça sont pas rentrés dans la boucle pour dire on audit pour valider que les résultats que vous nous avez sortis ils sont bons pour avoir juste un regard extérieur pour être sûr qu'on a pas loupé des des trucs bizarres  
**Lucas Bourdallé:** Non mais mais même si c'était que ça soit le cas ou pas, moi je pense qu'il faut pas. Et encore une fois, on vous refait l'appel du pied.  
   
 

### 00:37:43

   
**Lucas Bourdallé:** Si vous voulez ou si vous pensez c'est pas vous, dites-nous qui. Mais ça c'est quelque chose qu'on voudrait bien avoir une certe partie le faire parce qu'aujourd'hui on crée le dataset, on fait l'évaluation, on dit nous-même regardez on est des champions mais c'est pas  
**Alexandre Guitton:** J'ai c'est c'est sûr que c'est pas nous côté plateforme.  
**Lucas Bourdallé:** bon.  
**Alexandre Guitton:** Moi moi ce qui enfin c'est c'est pour ça que je pose la question c'est je ne sais pas qui ça devrait être et en fait je sais même pas déjà qui est cas sur toute la partie product qu'on va qu' AI product au sens prod du terme qu'on va mettre dans le produit. Je en fait ce genre de truc qui qui  
**Adèle Lutun:** Mais justement lesistes, on peut pas leur demander.  
**Alexandre Guitton:** valide je aucune  
**Lucas Bourdallé:** Alors, il y a une vision produit de l'agent et de tout ce qu'on va faire.  
**Alexandre Guitton:** idée.  
**Lucas Bourdallé:** Effectivement là on est sur quelque chose de plus ces règles là, c'est Gard Rails. Je pense que ça mérite un sujet et ça mérite effectivement un stream avec une équipe peut-être dédiée euh pour voir  
**Aurélien Texier:** Il faut que tu sois pas jugé parti.  
   
 

### 00:38:32 {#00:38:32}

   
**Lucas Bourdallé:** ça.  
**Aurélien Texier:** Donc c'est ça qui est important et ça c'est quelque chose qui est particulier,  
**Alexandre Guitton:** Je vas-y vas-y.  
**Aurélien Texier:** c'est que la théorie comment la théorie de l'audit veut que le nom  
**Alexandre Guitton:** Pardon,  
**Lucas Bourdallé:** Oui.  
**Alexandre Guitton:** pardon.  
**Aurélien Texier:** jugé parti doit être qu'elle n'est même pas dans la même équipe si on veut vraiment être propre. Et je pense que c'est important pour en avoir fait. Euh ça serait par exemple, c'est ce que c'est ce qu'a mentionné Lucas, ça serait Prodsc par exemple, on n'est pas dans les mêmes équipes, enfin on est dans la même boîte mais euh qui est vraiment une personne qui prennent les choses froidement et qui disent "Ouais, je suis à l'aise, j'ai fait mon test et euh et là j'ai un rôle de de d'auditeur." Euh et nous vraiment et j'insiste sur ce qu'a dit Lucard, on aimerait énormément que quelqu'un le fasse parce que aujourd'hui on produit et on on valide pas vraiment mais on dit  
**Lucas Bourdallé:** C'est  
**LVL- Louis Armstrong:** Mais euh enfin  
**Adèle Lutun:** demander à quelqu'un de chez Frédéric Charpentier du coup.  
   
 

### 00:39:20 {#00:39:20}

   
**Aurélien Texier:** que  
**Adèle Lutun:** Enfin, lui il était dans les conversations. Du coup, on peut tout à fait demander àce que après la discussion qu'on a eu,  
**LVL- Louis Armstrong:** hop  
**Adèle Lutun:** on a besoin qu'il a quelqu'un d'autre qui fasse une revue d'un point de vue technique et cetera et puis enfin, je vois pas pourquoi il dirait non.  
**LVL- Louis Armstrong:** en fait.  
**Aurélien Texier:** par exemple  
**LVL- Louis Armstrong:** Ouais, pour moi c'est ça en fait. Il y a il y a deux éléments qui seraient qui étaient intéressants de faire. C'est un euh les pen test de Prodsc. Donc ça, on leur a demandé. Euh et ensuite de euh voir avec toi Adel côté légal si euh on a bien interprété les règles et mis en place euh et ensuite et ensuite  
**Adèle Lutun:** Ah oui non mais ça moi je vais aller la lire la page confluence là qu' a envoyé  
**Lucas Bourdallé:** Faut  
**Adèle Lutun:** Lucas.  
**LVL- Louis Armstrong:** et ensuite le l'éval en tant que tel, enfin une fois qu'on a une évalu et et on avance dessus. Enfin, je veux dire, c'est c'est chaque chaque équipe met ses évol et et les et  
**Lucas Bourdallé:** juste qu'on se se synchronise, tu vois pour l'histoire de pen test, on a mis aussi on a fait les datasets, c'est la data science.  
   
 

### 00:40:20 {#00:40:20}

   
**Lucas Bourdallé:** On l'a fait parce que c'est pas tout le monde qui sait faire du quoi du scoring de Jacard ou des trucs comme ça. Donc en attendant que on est vraiment les spécialistes, nous avec nos petits moyens, on a fait ça comme ça, on a quelque chose assez clean pour que quelqu'un reprenne le sujet parce qu'on veut pas lui laisser en jacher. Il faut juste qu'on se synchronise notamment s'il y a des pen test parce que encore une fois on a changé le dataset pas plus tard que hier ou aujourd'hui. Donc si les gens font des des tests sur quelque chose qui est déjà obsolète, bon c'est un peu dommage. Euh voilà.  
**LVL- Louis Armstrong:** Ouais, passage du coup. Ouais, Fred.  
**Lucas Bourdallé:** Euh mais je crois que tu l'avais invité, il me  
**LVL- Louis Armstrong:** Ouais, ouais. Enfin,  
**Lucas Bourdallé:** semble.  
**LVL- Louis Armstrong:** je crois qu'il a dit qu'il pouvait pas venir mais il nous a dit aussi semaine semaine dernière qu' qu'il mettrait sur le truc. Donc ça vous pouvez le pinguer  
**Louis Perreau:** Ouais, je lui partage la doc. Je lui envo je pense que  
**Lucas Bourdallé:** On a 19 minutes de retard sur  
   
 

### 00:41:11 {#00:41:11}

   
**Louis Perreau:** Ouais, on a un autre meeting.  
**Adèle Lutun:** OK, ben amusez-vous bien.  
**Louis Perreau:** M.  
**Adèle Lutun:** Moi, je relie les trucs de Lucas et si jamais je pense que d'un point de vue pour  
**Lucas Bourdallé:** votre  
**Adèle Lutun:** les non fluent comme moi, si c'est possible d'avoir le les layers comme vous avez mis par rapport à un flux de données parce que du coup nous par exemple, tu vois, genre pour des autres gens du légal qui savent pas Big Query à quel endroit c'est et cetera, je pense que ça pourrait être assez parlant si ça pouvait être fait dans avec le flux de données en plus.  
**Louis Perreau:** l'interaction entre le plugging et les systèmes  
**Adèle Lutun:** Genre je pose ma question, j'ai ça qui vient tout de suite.  
**Lucas Bourdallé:** Donc OK.  
**Adèle Lutun:** Mes données, elles arrivent par là, elle passent.  
**Lucas Bourdallé:** OK.  
**Adèle Lutun:** Vous voyez ce que je dis ?  
**Lucas Bourdallé:** Ouais. Ouais. C'est bon. Donc en fait, on met utilisateur big query doctolib.  
**Adèle Lutun:** Super.  
**Louis Perreau:** Vache,  
**Lucas Bourdallé:** Quand est-ce côté entropie ? Quand est-ce quand est-ce revient ?  
**Adèle Lutun:** Voilà.  
**Louis Perreau:** ça marche.  
**Adèle Lutun:** Super.  
**Lucas Bourdallé:** OK,  
**Louis Perreau:** C'est  
**Adèle Lutun:** Merci beaucoup. On se tient au courant sur les relectures des locks.  
**Louis Perreau:** ça.  
**Adèle Lutun:** À plus. Yeah.  
**Lucas Bourdallé:** merci à tout le monde.  
**Aurélien Texier:** Merci beaucoup.  
**Alexandre Guitton:** Merci.  
**Lucas Bourdallé:** On vous envoie les on vous envoie les press et tout.  
**Alexandre Guitton:** Mm.  
**Aurélien Texier:** Merci beaucoup.  
**Louis Perreau:** Merci. C'est partagé à tout le monde.  
   
 

### Transcription terminée après 00:42:25

*Cette transcription modifiable a été générée par ordinateur et peut contenir des erreurs. Les utilisateurs peuvent également modifier le texte après sa création.*