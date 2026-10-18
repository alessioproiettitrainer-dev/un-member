// Valori medi indicativi per 100 g (kcal, proteine, carboidrati, grassi) e porzione tipica in grammi.
// Fonte: medie delle tabelle di composizione degli alimenti (CREA, USDA) ed etichette dei prodotti più comuni in Italia.
// [nome, kcal, P, C, G, porzione]
export const FOODS = [
  // pasta, riso, cereali (cotti se non indicato)
  ['Pasta di semola (cruda)', 353, 12.5, 72, 1.5, 80], ['Pasta di semola cotta', 158, 5.8, 31, 0.9, 200], ['Pasta integrale (cruda)', 340, 13.5, 66, 2.5, 80], ['Pasta integrale cotta', 140, 5.5, 27, 1, 200],
  ['Pasta all\'uovo (cruda)', 366, 13, 68, 4.3, 80], ['Pasta di legumi (cruda)', 345, 22, 52, 2.5, 80], ['Gnocchi di patate', 150, 3.5, 32, 0.5, 200], ['Riso bianco (crudo)', 355, 7, 79, 0.6, 80],
  ['Riso bianco cotto', 130, 2.7, 28, 0.3, 180], ['Riso integrale (crudo)', 350, 7.5, 74, 2.5, 80], ['Riso basmati (crudo)', 352, 8, 78, 0.6, 80], ['Couscous (crudo)', 356, 12.8, 72, 0.6, 80],
  ['Farro (crudo)', 335, 15, 67, 2.5, 80], ['Orzo perlato (crudo)', 319, 10, 70, 1.5, 80], ['Quinoa (cruda)', 368, 14, 64, 6, 80], ['Avena in fiocchi', 372, 13, 61, 7, 40],
  ['Corn flakes', 370, 7, 84, 0.9, 30], ['Muesli', 370, 9, 64, 7, 40], ['Granola', 450, 9, 64, 17, 40], ['Polenta cotta', 70, 1.6, 15, 0.3, 250],
  // pane e prodotti da forno
  ['Pane comune (bianco)', 270, 8.5, 55, 1, 50], ['Pane integrale', 245, 9, 45, 2.5, 50], ['Pane di segale', 250, 8.5, 48, 3, 50], ['Pane in cassetta', 265, 8, 48, 4, 30],
  ['Piadina', 310, 8, 50, 9, 100], ['Grissini', 410, 12, 68, 9, 20], ['Crackers', 420, 10, 70, 10, 25], ['Fette biscottate', 410, 11, 75, 6, 20],
  ['Gallette di riso', 385, 8, 81, 3, 10], ['Taralli', 450, 10, 65, 17, 30], ['Focaccia', 300, 7, 45, 10, 100], ['Friselle', 380, 12, 75, 3, 40],
  // pizza e piatti pronti
  ['Pizza margherita', 260, 11, 35, 8.5, 300], ['Pizza marinara', 230, 7, 40, 5, 300], ['Pizza diavola', 275, 12, 33, 11, 300], ['Pizza capricciosa', 255, 11, 31, 10, 330],
  ['Pizza 4 formaggi', 300, 13, 30, 14, 300], ['Pizza al taglio', 270, 9, 38, 9, 150], ['Calzone', 270, 11, 32, 11, 350], ['Lasagne alla bolognese', 165, 9, 13, 8.5, 300],
  ['Pasta al pomodoro', 135, 4.5, 23, 3, 300], ['Pasta al ragù', 165, 7.5, 22, 5, 300], ['Pasta alla carbonara', 210, 9, 23, 9, 300], ['Pasta al pesto', 210, 6, 25, 9.5, 300],
  ['Pasta e fagioli', 110, 5, 17, 2.5, 300], ['Risotto ai funghi', 140, 3.5, 22, 4, 300], ['Parmigiana di melanzane', 160, 7, 7, 12, 250], ['Insalata di riso', 170, 6, 23, 6, 250],
  ['Arancino', 230, 6, 28, 10, 180], ['Panino con prosciutto e formaggio', 270, 14, 30, 10, 180], ['Hamburger (panino)', 260, 13, 28, 11, 220], ['Kebab (piadina)', 215, 12, 20, 10, 350],
  ['Sushi (misto)', 150, 6, 28, 1.5, 250], ['Poke bowl', 140, 8, 18, 4, 400], ['Patatine fritte', 300, 3.5, 38, 15, 150], ['Toast prosciutto e formaggio', 290, 15, 28, 13, 120],
  // carne
  ['Petto di pollo', 110, 23, 0, 1.5, 150], ['Petto di pollo alla griglia', 150, 31, 0, 3, 150], ['Cosce di pollo', 180, 18, 0, 12, 150], ['Petto di tacchino', 107, 24, 0, 1.2, 150],
  ['Manzo magro (fesa)', 120, 22, 0, 3.5, 150], ['Carne macinata di manzo 5%', 125, 21, 0, 5, 150], ['Carne macinata di manzo 15%', 215, 18, 0, 15, 150], ['Bistecca di manzo', 160, 22, 0, 8, 200],
  ['Filetto di manzo', 130, 21, 0, 5, 180], ['Hamburger di manzo', 230, 17, 0, 18, 150], ['Vitello (fesa)', 105, 21, 0, 2.5, 150], ['Maiale (lonza)', 145, 21, 0, 6.5, 150],
  ['Salsiccia di maiale', 300, 15, 1, 26, 100], ['Agnello', 200, 19, 0, 13, 150], ['Coniglio', 140, 21, 0, 6, 150], ['Cavallo', 115, 21, 0, 3.5, 150],
  // salumi
  ['Prosciutto crudo', 250, 26, 0, 16, 50], ['Prosciutto crudo sgrassato', 160, 29, 0, 5, 50], ['Prosciutto cotto', 135, 19, 1, 6, 50], ['Bresaola', 155, 32, 0, 2.5, 50],
  ['Speck', 300, 28, 0, 20, 50], ['Salame', 400, 25, 1, 33, 40], ['Mortadella', 315, 15, 1, 28, 50], ['Fesa di tacchino affettata', 100, 19, 2, 1.5, 50], ['Wurstel', 270, 13, 2, 23, 100],
  // pesce
  ['Salmone fresco', 200, 20, 0, 13, 150], ['Salmone affumicato', 145, 25, 0, 5, 50], ['Tonno fresco', 145, 24, 0, 5, 150], ['Tonno in scatola al naturale', 105, 25, 0, 0.8, 80],
  ['Tonno sott\'olio sgocciolato', 190, 25, 0, 10, 80], ['Merluzzo', 75, 17, 0, 0.5, 200], ['Orata', 120, 20, 0, 4.5, 200], ['Branzino', 100, 19, 0, 2.5, 200],
  ['Sgombro', 170, 18, 0, 11, 150], ['Gamberi', 85, 18, 1, 1, 150], ['Calamari', 90, 16, 3, 1.5, 150], ['Cozze', 85, 12, 3.5, 2, 200],
  ['Polpo', 80, 15, 2, 1, 200], ['Sardine', 130, 20, 0, 5.5, 150], ['Bastoncini di pesce', 210, 13, 18, 9, 120], ['Platessa', 85, 17, 0, 1.5, 200],
  // uova e latticini
  ['Uovo intero', 140, 12.5, 0.5, 9.5, 60], ['Albume d\'uovo', 48, 11, 0.7, 0.2, 100], ['Latte intero', 64, 3.3, 4.9, 3.6, 200], ['Latte parzialmente scremato', 46, 3.4, 5, 1.6, 200],
  ['Latte scremato', 35, 3.5, 5, 0.2, 200], ['Bevanda di soia', 40, 3.3, 1.5, 1.8, 200], ['Bevanda di avena', 45, 0.8, 7, 1.4, 200], ['Bevanda di mandorla', 25, 0.6, 3, 1.1, 200],
  ['Yogurt bianco intero', 65, 3.8, 4.5, 3.5, 125], ['Yogurt magro', 40, 4.3, 5, 0.2, 125], ['Yogurt greco 0%', 57, 10, 4, 0, 150], ['Yogurt greco intero', 120, 6.5, 4, 9, 150],
  ['Yogurt alla frutta', 95, 3.5, 15, 2.5, 125], ['Skyr', 63, 11, 4, 0.2, 150], ['Ricotta vaccina', 145, 9, 3.5, 11, 100], ['Ricotta light', 90, 10, 4, 4, 100],
  ['Fiocchi di latte', 98, 11, 3, 4.5, 150], ['Mozzarella', 255, 18, 1, 20, 125], ['Mozzarella light', 165, 20, 1, 9, 125], ['Mozzarella di bufala', 285, 17, 0.5, 24, 125],
  ['Parmigiano Reggiano', 392, 33, 0, 28, 20], ['Grana Padano', 384, 33, 0, 28, 20], ['Pecorino', 390, 27, 0, 31, 20], ['Emmental', 380, 29, 0.5, 29, 30],
  ['Scamorza', 335, 25, 1, 26, 50], ['Stracchino', 300, 18, 0.5, 25, 50], ['Gorgonzola', 330, 19, 0.5, 28, 50], ['Feta', 265, 14, 4, 21, 50],
  ['Formaggio spalmabile', 250, 6, 3.5, 24, 30], ['Formaggio spalmabile light', 150, 8, 5, 11, 30], ['Burrata', 330, 14, 1, 30, 100], ['Panna da cucina', 290, 2.5, 3.5, 30, 50],
  // legumi
  ['Ceci in scatola (sgocciolati)', 120, 7, 16, 2.5, 150], ['Ceci secchi', 335, 21, 47, 6, 50], ['Lenticchie cotte', 115, 9, 17, 0.4, 150], ['Lenticchie secche', 325, 23, 51, 1, 50],
  ['Fagioli borlotti in scatola', 95, 6.5, 14, 0.5, 150], ['Fagioli cannellini in scatola', 90, 6.5, 13, 0.5, 150], ['Piselli', 80, 5.5, 13, 0.4, 150], ['Fave', 75, 6, 11, 0.4, 150],
  ['Edamame', 120, 11, 9, 5, 100], ['Tofu', 120, 13, 2, 7, 100], ['Tempeh', 190, 19, 9, 11, 100], ['Seitan', 120, 21, 4, 2, 100], ['Hummus', 270, 8, 14, 20, 50],
  // verdura
  ['Insalata (lattuga)', 15, 1.4, 2, 0.2, 80], ['Rucola', 28, 2.6, 3.7, 0.7, 50], ['Spinaci', 23, 3, 3.5, 0.4, 200], ['Pomodori', 18, 0.9, 3.9, 0.2, 200],
  ['Zucchine', 17, 1.2, 3, 0.3, 200], ['Melanzane', 25, 1, 6, 0.2, 200], ['Peperoni', 26, 1, 6, 0.3, 200], ['Carote', 41, 0.9, 10, 0.2, 150],
  ['Broccoli', 34, 2.8, 7, 0.4, 200], ['Cavolfiore', 25, 2, 5, 0.3, 200], ['Cavolo cappuccio', 25, 1.3, 6, 0.1, 150], ['Finocchi', 31, 1.2, 7, 0.2, 200],
  ['Cetrioli', 15, 0.7, 3.6, 0.1, 150], ['Funghi champignon', 22, 3, 3.3, 0.3, 150], ['Fagiolini', 31, 1.8, 7, 0.2, 200], ['Asparagi', 20, 2.2, 3.9, 0.1, 150],
  ['Carciofi', 47, 3.3, 10, 0.2, 150], ['Cipolla', 40, 1.1, 9, 0.1, 50], ['Patate', 77, 2, 17, 0.1, 200], ['Patate dolci', 86, 1.6, 20, 0.1, 200],
  ['Mais in scatola', 85, 2.8, 16, 1.2, 80], ['Zucca', 26, 1, 6.5, 0.1, 200], ['Verdure grigliate', 45, 1.5, 5, 2, 200], ['Minestrone di verdure', 45, 2, 7, 1, 300],
  // frutta
  ['Mela', 52, 0.3, 14, 0.2, 180], ['Banana', 89, 1.1, 23, 0.3, 120], ['Arancia', 47, 0.9, 12, 0.1, 200], ['Pera', 57, 0.4, 15, 0.1, 180],
  ['Fragole', 32, 0.7, 7.7, 0.3, 150], ['Kiwi', 61, 1.1, 15, 0.5, 100], ['Uva', 69, 0.7, 18, 0.2, 150], ['Pesca', 39, 0.9, 10, 0.3, 150],
  ['Albicocche', 48, 1.4, 11, 0.4, 150], ['Anguria', 30, 0.6, 7.6, 0.2, 300], ['Melone', 34, 0.8, 8, 0.2, 200], ['Ananas', 50, 0.5, 13, 0.1, 150],
  ['Mirtilli', 57, 0.7, 14, 0.3, 100], ['Ciliegie', 63, 1, 16, 0.2, 150], ['Mandarini', 53, 0.8, 13, 0.3, 150], ['Fichi', 74, 0.8, 19, 0.3, 100],
  ['Cachi', 70, 0.6, 18, 0.2, 200], ['Avocado', 160, 2, 9, 15, 100], ['Frutti di bosco', 45, 1, 10, 0.3, 100], ['Datteri secchi', 280, 2.5, 75, 0.4, 30],
  ['Uvetta', 300, 3, 79, 0.5, 30], ['Albicocche secche', 240, 3.4, 63, 0.5, 30], ['Spremuta d\'arancia', 45, 0.7, 10, 0.2, 200], ['Succo di frutta', 50, 0.3, 12, 0.1, 200],
  // frutta secca e semi
  ['Mandorle', 580, 21, 22, 50, 30], ['Noci', 650, 15, 14, 65, 30], ['Nocciole', 630, 15, 17, 61, 30], ['Anacardi', 553, 18, 30, 44, 30],
  ['Pistacchi', 560, 20, 28, 45, 30], ['Arachidi', 570, 26, 16, 49, 30], ['Burro di arachidi', 590, 25, 20, 50, 20], ['Semi di chia', 486, 17, 42, 31, 15],
  ['Semi di lino', 534, 18, 29, 42, 15], ['Semi di zucca', 560, 30, 11, 49, 20], ['Mix frutta secca', 600, 18, 18, 52, 30],
  // condimenti e grassi
  ['Olio extravergine d\'oliva', 884, 0, 0, 100, 10], ['Burro', 740, 0.8, 0.5, 82, 10], ['Maionese', 680, 1, 1.5, 75, 15], ['Ketchup', 110, 1.3, 25, 0.2, 15],
  ['Pesto alla genovese', 520, 5, 6, 53, 30], ['Sugo di pomodoro', 40, 1.4, 6, 1, 100], ['Ragù alla bolognese', 140, 9, 5, 9, 100], ['Aceto balsamico', 88, 0.5, 17, 0, 10],
  ['Zucchero', 400, 0, 100, 0, 5], ['Miele', 304, 0.3, 82, 0, 10], ['Marmellata', 250, 0.5, 60, 0.1, 20], ['Crema spalmabile alle nocciole', 540, 6, 57, 31, 20],
  // colazione e dolci
  ['Cornetto vuoto', 410, 8, 45, 21, 50], ['Cornetto alla crema', 380, 7, 48, 17, 70], ['Biscotti secchi', 420, 7, 75, 10, 30], ['Biscotti frollini', 480, 7, 68, 20, 30],
  ['Pancake', 230, 6, 30, 9, 100], ['Torta (ciambellone)', 380, 6, 52, 16, 80], ['Tiramisù', 290, 6, 28, 17, 100], ['Gelato alla crema', 210, 4, 25, 11, 100],
  ['Gelato alla frutta', 140, 1, 32, 1, 100], ['Cioccolato fondente 70%', 580, 8, 33, 43, 20], ['Cioccolato al latte', 545, 7, 57, 31, 20], ['Barretta proteica', 360, 30, 35, 12, 60],
  ['Merendina', 420, 6, 58, 18, 35], ['Plumcake', 400, 6, 55, 17, 35], ['Cannolo siciliano', 380, 7, 40, 21, 100], ['Panettone', 380, 7, 50, 17, 80],
  // bevande e integratori
  ['Caffè espresso', 2, 0.1, 0, 0, 30], ['Cappuccino', 45, 2.5, 4, 2, 150], ['Coca-Cola', 42, 0, 10.6, 0, 330], ['Bibita zero', 1, 0, 0, 0, 330],
  ['Birra', 43, 0.5, 3.6, 0, 330], ['Vino rosso', 85, 0.1, 2.6, 0, 150], ['Vino bianco', 82, 0.1, 2.6, 0, 150], ['Spritz', 120, 0, 12, 0, 200],
  ['Proteine whey (polvere)', 380, 78, 7, 6, 30], ['Proteine vegetali (polvere)', 380, 75, 8, 7, 30], ['Bevanda isotonica', 25, 0, 6, 0, 500],
];
